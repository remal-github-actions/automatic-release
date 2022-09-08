import * as core from '@actions/core'
import picomatch from 'picomatch'
import {createRelease} from './internal/createRelease'
import {incrementVersion} from './internal/incrementVersion'
import {newOctokitInstance} from './internal/octokit'
import {retrieveCommitComparison} from './internal/retrieveCommitComparison'
import {retrieveDefaultBranch} from './internal/retrieveDefaultBranch'
import {retrievePullRequestsAssociatedWithCommit} from './internal/retrievePullRequestsAssociatedWithCommit'
import {retrieveRepo} from './internal/retrieveRepo'
import {retrieveLastVersionTag} from './internal/retrieveVersionTags'
import {CommitPullRequest, VersionIncrementMode} from './internal/types'

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const githubToken = core.getInput('githubToken', {required: true})
const versionTagPrefix = core.getInput('versionTagPrefix', {required: false})
const allowedVersionTagPrefixes = core.getInput('allowedVersionTagPrefixes', {required: false})
    .split(/[\s,;]+/)
    .filter(it => it.length)
allowedVersionTagPrefixes.push(versionTagPrefix)
const expectedFilesToChange = core.getInput('expectedFilesToChange', {required: false})
    .split(/[\s,;]+/)
    .filter(it => it.length)
const allowedCommitPrefixes = core.getInput('allowedCommitPrefixes', {required: false})
    .split(/[\s,;]+/)
    .filter(it => it.length)
const allowedPullRequestLabels = core.getInput('allowedPullRequestLabels', {required: false})
    .split(/[\s,;]+/)
    .filter(it => it.length)
const versionIncrementMode = core.getInput(
    'versionIncrementMode',
    {required: true}
).toLowerCase() as VersionIncrementMode
const dryRun = core.getInput('dryRun', {required: true}).toLowerCase() === 'true'

const octokit = newOctokitInstance(githubToken)

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

async function run(): Promise<void> {
    try {
        const repo = await retrieveRepo(octokit)

        const lastVersionTag = await retrieveLastVersionTag(octokit, allowedVersionTagPrefixes)
        if (lastVersionTag == null) {
            core.info(`Skipping release creation, as no version tags found for repository ${repo.html_url}`)
            return
        }
        core.info(`Last version: '${lastVersionTag.version}', tag: ${repo.html_url}/releases/tag/${lastVersionTag.tag.name}`)

        if (lastVersionTag.version.hasSuffix) {
            core.warning(`Skipping release creation, as last version has suffix: '${lastVersionTag.version}'`)
            return
        }

        const defaultBranch = await retrieveDefaultBranch(octokit, repo)
        const commitComparison = await retrieveCommitComparison(octokit, defaultBranch, lastVersionTag.tag)
        const commitComparisonCommits = commitComparison.commits || []
        core.warning(JSON.stringify(commitComparison, null, 2))
        if (!commitComparisonCommits.length) {
            const commitComparisonUrl = commitComparison.html_url
                || `${repo.html_url}/compare/${lastVersionTag.tag.commit.sha}...${defaultBranch.commit.sha}`
            core.info(`No commits found after last version tag: ${commitComparisonUrl}`)
            return
        }


        const commitComparisonFiles = commitComparison.files
        if (expectedFilesToChange.length && commitComparisonFiles != null) {
            const expectedFilesToChangeMatcher = picomatch(expectedFilesToChange)
            let areExpectedFilesChanged = false
            for (const commitComparisonFile of commitComparisonFiles) {
                if (expectedFilesToChangeMatcher(commitComparisonFile.filename)) {
                    areExpectedFilesChanged = true
                    core.info(`Expected file was changed: ${commitComparisonFile.blob_url}`)
                }
            }
            if (!areExpectedFilesChanged) {
                core.warning(`No expected files were changed`)
                return
            }
        }


        const commitPullRequests: CommitPullRequest[] = []

        forEachCommit: for (const commit of commitComparisonCommits) {
            const message = commit.commit.message
            core.debug(`Testing if commit is allowed: ${message}: ${commit.html_url}`)

            for (const allowedCommitPrefix of allowedCommitPrefixes) {
                if (message.startsWith(allowedCommitPrefix)) {
                    const messageAfterPrefix = message.substring(allowedCommitPrefix.length)
                    if (!messageAfterPrefix.length || messageAfterPrefix.match(/^\W/)) {
                        core.info(`Allowed commit by commit message prefix ('${allowedCommitPrefix}'): ${message}: ${commit.html_url}`)
                        continue forEachCommit
                    }
                }
            }

            const pullRequestsAssociatedWithCommit = await retrievePullRequestsAssociatedWithCommit(octokit, commit)
            for (const pullRequestAssociatedWithCommit of pullRequestsAssociatedWithCommit) {
                const labels = pullRequestAssociatedWithCommit.labels.map(it => it.name)
                for (const allowedPullRequestLabel of allowedPullRequestLabels) {
                    if (labels.includes(allowedPullRequestLabel)) {
                        core.info(`Allowed commit by Pull Request label ('${allowedPullRequestLabel}'): ${message}: ${commit.html_url}`)
                        if (!commitPullRequests.map(it => it.commit.sha).includes(commit.sha)) {
                            commitPullRequests.push({
                                commit,
                                pullRequest: pullRequestAssociatedWithCommit,
                            })
                        }
                        continue forEachCommit
                    }
                }
            }

            core.info(`Not allowed commit: ${message}: ${commit.html_url}`)
            return
        }


        const releaseVersion = incrementVersion(lastVersionTag.version, versionIncrementMode)

        const releaseTag = `${versionTagPrefix}${releaseVersion}`

        let releaseDescription = ''
        if (commitPullRequests.length) {
            releaseDescription = '# What\'s Changed\n'
            for (const commitPullRequest of commitPullRequests) {
                releaseDescription += `\n* ${commitPullRequest.commit.commit.message} (#${commitPullRequest.pullRequest.number})`
                const login = commitPullRequest.pullRequest.user?.login
                if (login != null) {
                    releaseDescription += ` @${login}`
                }
            }
        }

        core.info(`Creating a new release ${releaseVersion} (Git tag: ${releaseTag})`
            + (releaseDescription.length ? ` with description:\n${releaseDescription}` : ` with empty description`)
        )

        if (dryRun) {
            core.warning(`Skipping release creation, as dry run is enabled`)
            return
        }

        await createRelease(octokit, defaultBranch, releaseVersion, releaseTag, releaseDescription)


    } catch (error) {
        core.setFailed(error instanceof Error ? error : (error as object).toString())
        throw error
    }
}

//noinspection JSIgnoredPromiseFromCall
run()
