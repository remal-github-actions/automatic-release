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
import {ChangeLogItem, CommitPullRequest, VersionIncrementMode} from './internal/types'

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
        if (!commitComparisonCommits.length) {
            core.info(`No commits found after last version tag: ${commitComparison.html_url}`)
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
                core.info(`No expected files were changed:\n  ${expectedFilesToChange.join('\n  ')}`)
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
                        core.info(`Allowed commit by commit message prefix ('${allowedCommitPrefix}')`
                            + `: ${message.split(/[\n\r]+/)[0]}: ${commit.html_url}`
                        )
                        continue forEachCommit
                    }
                }
            }

            const pullRequestsAssociatedWithCommit = await retrievePullRequestsAssociatedWithCommit(octokit, commit)
            for (const pullRequestAssociatedWithCommit of pullRequestsAssociatedWithCommit) {
                const labels = pullRequestAssociatedWithCommit.labels.map(it => it.name)
                for (const allowedPullRequestLabel of allowedPullRequestLabels) {
                    if (labels.includes(allowedPullRequestLabel)) {
                        core.info(`Allowed commit by Pull Request label ('${allowedPullRequestLabel}')`
                            + `: ${message.split(/[\n\r]+/)[0]}: ${pullRequestAssociatedWithCommit.html_url}`
                        )
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

        const changeLogItems: ChangeLogItem[] = []
        if (commitPullRequests.length) {
            for (const commitPullRequest of commitPullRequests) {
                const message = commitPullRequest.pullRequest.title
                const author = commitPullRequest.pullRequest.user?.login || undefined
                const pullRequestNumber = commitPullRequest.pullRequest.number
                const alreadyCreatedChangeLogItem = changeLogItems.find(item =>
                    item.message === message && item.author === author
                )
                if (alreadyCreatedChangeLogItem != null) {
                    if (!alreadyCreatedChangeLogItem.pullRequestNumbers.includes(pullRequestNumber)) {
                        alreadyCreatedChangeLogItem.pullRequestNumbers.push(pullRequestNumber)
                    }
                } else {
                    changeLogItems.push({
                        message,
                        author,
                        pullRequestNumbers: [pullRequestNumber],
                    })
                }
            }
        }
        let releaseDescription = ''
        if (changeLogItems.length) {
            releaseDescription = '# What\'s Changed\n'
            for (const changeLogItem of changeLogItems) {
                releaseDescription += [
                    '\n*',
                    changeLogItem.message,
                    changeLogItem.pullRequestNumbers.length
                        ? `(#${changeLogItem.pullRequestNumbers.join(', #')})`
                        : '',
                    changeLogItem.author != null
                        ? `@${changeLogItem.author.replace(/\[bot\]$/, '')}`
                        : ''
                ].filter(it => it.length).join(' ')
            }
        }


        core.info(`Creating a new release '${releaseVersion}' with Git tag: '${releaseTag}', and with `
            + (releaseDescription.length
                    ? `description:\n  ${releaseDescription.split('\n').join('\n  ')}`
                    : `empty description`
            )
        )

        if (dryRun) {
            core.warning(`Skipping release creation, as dry run is enabled`)
            return
        }

        const createdRelease = await createRelease(
            octokit,
            defaultBranch,
            releaseVersion,
            releaseTag,
            releaseDescription
        )
        core.info(`Created release: ${createdRelease.html_url}`)


    } catch (error) {
        core.setFailed(error instanceof Error ? error : (error as object).toString())
        throw error
    }
}

//noinspection JSIgnoredPromiseFromCall
run()
