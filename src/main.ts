import * as core from '@actions/core'
import { context } from '@actions/github'
import picomatch from 'picomatch'
import { createRelease } from './internal/createRelease'
import { incrementVersion } from './internal/incrementVersion'
import { newOctokitInstance } from './internal/octokit'
import { retrieveCheckRuns } from './internal/retrieveCheckRuns'
import { retrieveCommitComparison } from './internal/retrieveCommitComparison'
import { retrieveDefaultBranch } from './internal/retrieveDefaultBranch'
import { retrievePullRequestsAssociatedWithCommit } from './internal/retrievePullRequestsAssociatedWithCommit'
import { retrieveRepo } from './internal/retrieveRepo'
import { retrieveLastVersionTag } from './internal/retrieveVersionTags'
import { ChangeLogItem, ChangeLogItemType, Commit, VersionIncrementMode } from './internal/types'
import { hasNotEmptyIntersection } from './internal/utils'

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const githubToken = core.getInput('githubToken', { required: true })
const versionTagPrefix = core.getInput('versionTagPrefix', { required: false })
const allowedVersionTagPrefixes = core.getInput('allowedVersionTagPrefixes', { required: false })
    .split(/[\n\r,;]+/)
    .map(it => it.trim())
    .filter(it => it.length)
allowedVersionTagPrefixes.push(versionTagPrefix)
const expectedFilesToChange = core.getInput('expectedFilesToChange', { required: false })
    .split(/[\n\r,;]+/)
    .map(it => it.trim())
    .filter(it => it.length)
const allowedCommitPrefixes = core.getInput('allowedCommitPrefixes', { required: false })
    .split(/[\n\r,;]+/)
    .map(it => it.trim())
    .filter(it => it.length)
const allowedPullRequestLabels = core.getInput('allowedPullRequestLabels', { required: false })
    .split(/[\n\r,;]+/)
    .map(it => it.trim())
    .filter(it => it.length)
const skippedChangelogCommitPrefixes = core.getInput('skippedChangelogCommitPrefixes', { required: false })
    .split(/[\n\r,;]+/)
    .map(it => it.trim())
    .filter(it => it.length)
const dependencyUpdatesPullRequestLabels = core.getInput('dependencyUpdatesPullRequestLabels', { required: false })
    .split(/[\n\r,;]+/)
    .map(it => it.trim())
    .filter(it => it.length)
const dependencyUpdatesAuthors = core.getInput('dependencyUpdatesAuthors', { required: false })
    .split(/[\n\r,;]+/)
    .map(it => it.trim())
    .filter(it => it.length)
const versionIncrementMode = core.getInput(
    'versionIncrementMode',
    { required: true }
).toLowerCase() as VersionIncrementMode
const dryRun = core.getInput('dryRun', { required: true }).toLowerCase() === 'true'

const octokit = newOctokitInstance(githubToken)

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

async function run(): Promise<void> {
    try {
        await core.group('Parameters', async () => {
            core.info(`versionTagPrefix: ${versionTagPrefix}`)
            core.info(`allowedVersionTagPrefixes:\n  ${allowedVersionTagPrefixes.join('\n  ')}`)
            core.info(`expectedFilesToChange:\n  ${expectedFilesToChange.join('\n  ')}`)
            core.info(`allowedCommitPrefixes:\n  ${allowedCommitPrefixes.join('\n  ')}`)
            core.info(`allowedPullRequestLabels:\n  ${allowedPullRequestLabels.join('\n  ')}`)
            core.info(`skippedChangelogCommitPrefixes:\n  ${skippedChangelogCommitPrefixes.join('\n  ')}`)
            core.info(`versionIncrementMode: ${versionIncrementMode}`)
            core.info(`dryRun: ${dryRun}`)
        })

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


        const checkRuns = await retrieveCheckRuns(octokit, defaultBranch.commit.sha)
        const failureCheckRuns = checkRuns.filter(it => ![
            'success',
            'neutral',
            'cancelled',
            'skipped',
            'action_required',
        ].includes(it.conclusion || ''))
        if (failureCheckRuns.length) {
            const currentWorkflowRun = await octokit.actions.getWorkflowRun({
                owner: context.repo.owner,
                repo: context.repo.repo,
                run_id: context.runId,
            }).then(it => it.data)
            const currentCheckSuiteId = currentWorkflowRun.check_suite_id

            let failureCheckRunsExceptCurrent = failureCheckRuns
            if (currentCheckSuiteId != null) {
                failureCheckRunsExceptCurrent = failureCheckRunsExceptCurrent
                    .filter(checkRun => checkRun.check_suite?.id !== currentCheckSuiteId)
            }

            if (failureCheckRunsExceptCurrent.length) {
                let message = `${failureCheckRunsExceptCurrent.length} check run(s) failed for '${defaultBranch.name}' branch:`
                for (const failureCheckRun of failureCheckRunsExceptCurrent) {
                    message += `\n  ${failureCheckRun.html_url}`
                    if (failureCheckRun.output?.title != null) {
                        message += ` (${failureCheckRun.output?.title})`
                    }
                }
                throw new Error(message)
            }
        }


        const changeLogItems: ChangeLogItem[] = []

        function addChangelogItem(
            commit: Commit,
            type: ChangeLogItemType | undefined,
            message: string,
            originalMessage: string,
            author: string | null | undefined = undefined,
            pullRequestNumber: number | null | undefined = undefined
        ) {
            message = message.trim()
            if (!message.length) return

            for (const skippedChangelogCommitPrefix of skippedChangelogCommitPrefixes) {
                if (originalMessage.startsWith(skippedChangelogCommitPrefix)) {
                    const messageAfterPrefix = originalMessage.substring(skippedChangelogCommitPrefix.length)
                    if (!messageAfterPrefix.length
                        || messageAfterPrefix.match(/^\W/)
                        || skippedChangelogCommitPrefix.match(/\W$/)
                    ) {
                        core.info(`Excluding changelog message by prefix '${skippedChangelogCommitPrefix}': ${originalMessage}`)
                        return
                    }
                }
            }

            if (author == null) author = undefined
            if (pullRequestNumber == null) pullRequestNumber = undefined

            const alreadyCreatedChangeLogItem = changeLogItems.find(item =>
                item.message === message && item.author === author
            )
            if (alreadyCreatedChangeLogItem != null) {
                if (pullRequestNumber != null) {
                    if (!alreadyCreatedChangeLogItem.pullRequestNumbers.includes(pullRequestNumber)) {
                        alreadyCreatedChangeLogItem.pullRequestNumbers.push(pullRequestNumber)
                    }
                }
                if (!alreadyCreatedChangeLogItem.commits.includes(commit.sha)) {
                    alreadyCreatedChangeLogItem.commits.push(commit.sha)
                }
                if (alreadyCreatedChangeLogItem.type == null) {
                    alreadyCreatedChangeLogItem.type = type
                }
            } else {
                changeLogItems.push({
                    message,
                    author: author != null ? author : undefined,
                    pullRequestNumbers: pullRequestNumber != null ? [pullRequestNumber] : [],
                    commits: [commit.sha],
                    type
                })
            }
        }

        forEachCommit: for (const commit of commitComparisonCommits) {
            const message = commit.commit.message
                .split(/[\n\r]+/)[0]
                .trim()
            core.debug(`Testing if commit is allowed: ${commit.html_url}: ${message}`)

            const pullRequestsAssociatedWithCommit = await retrievePullRequestsAssociatedWithCommit(octokit, commit)
            for (const pullRequestAssociatedWithCommit of pullRequestsAssociatedWithCommit) {
                const labels = pullRequestAssociatedWithCommit.labels.map(it => it.name)
                for (const allowedPullRequestLabel of allowedPullRequestLabels) {
                    if (labels.includes(allowedPullRequestLabel)) {
                        core.info(`Allowed commit by Pull Request label ('${allowedPullRequestLabel}'): ${message}: ${pullRequestAssociatedWithCommit.html_url}`)
                        let type: ChangeLogItemType | undefined = undefined
                        if (hasNotEmptyIntersection(labels, dependencyUpdatesPullRequestLabels)) {
                            type = 'dependency'
                        }
                        if (dependencyUpdatesAuthors.includes(pullRequestAssociatedWithCommit.user?.login || '')) {
                            type = 'dependency'
                        }
                        addChangelogItem(
                            commit,
                            type,
                            pullRequestAssociatedWithCommit.title,
                            pullRequestAssociatedWithCommit.title,
                            pullRequestAssociatedWithCommit.user?.login || undefined,
                            pullRequestAssociatedWithCommit.number
                        )
                        continue forEachCommit
                    }
                }
            }

            for (const allowedCommitPrefix of allowedCommitPrefixes) {
                if (message.startsWith(allowedCommitPrefix)) {
                    const messageAfterPrefix = message.substring(allowedCommitPrefix.length)
                    if (!messageAfterPrefix.length
                        || messageAfterPrefix.match(/^\W/)
                        || allowedCommitPrefix.match(/\W$/)
                    ) {
                        core.info(`Allowed commit by commit message prefix ('${allowedCommitPrefix}'): ${message}: ${commit.html_url}`)
                        let type: ChangeLogItemType | undefined = undefined
                        if (dependencyUpdatesAuthors.includes(commit.author?.name || '')) {
                            type = 'dependency'
                        }
                        addChangelogItem(
                            commit,
                            type,
                            messageAfterPrefix,
                            message,
                            commit.author?.name
                        )
                        continue forEachCommit
                    }
                }
            }

            core.info(`Not allowed commit: ${message}: ${commit.html_url}`)
            return
        }


        const releaseVersion = incrementVersion(lastVersionTag.version, versionIncrementMode)

        const releaseTag = `${versionTagPrefix}${releaseVersion}`

        const releaseDescriptionLines: string[] = ['_Automatic release_']
        if (changeLogItems.length) {
            function appendChangeLogItemToReleaseDescriptionLines(changeLogItem: ChangeLogItem) {
                const tokens = [
                    '*',
                    changeLogItem.message,
                ]

                if (changeLogItem.pullRequestNumbers.length) {
                    tokens.push(`(#${changeLogItem.pullRequestNumbers.join(', #')})`)
                } else {
                    tokens.push(`(${changeLogItem.commits.join(', ')})`)
                }

                if (changeLogItem.author != null) {
                    tokens.push(`@${changeLogItem.author.replace(/\[bot\]$/, '')}`)
                }

                releaseDescriptionLines.push(tokens.join(' '))
            }

            const typeTitles: Record<ChangeLogItemType, string> = {
                'dependency': '📦 Dependency updates',
            }

            releaseDescriptionLines.push('')
            releaseDescriptionLines.push('# What\'s Changed')
            releaseDescriptionLines.push('')

            changeLogItems
                .filter(it => it.type == null || !(it.type in typeTitles))
                .forEach(appendChangeLogItemToReleaseDescriptionLines)

            Object.entries(typeTitles).forEach(([type, title]) => {
                const currentChangeLogItems = changeLogItems
                    .filter(it => it.type === type)
                if (currentChangeLogItems.length) {
                    releaseDescriptionLines.push('')
                    releaseDescriptionLines.push(`## ${title}`)
                    releaseDescriptionLines.push('')

                    currentChangeLogItems.forEach(appendChangeLogItemToReleaseDescriptionLines)
                }
            })

        }


        const releaseDescription = releaseDescriptionLines.join('\n')
        const description = releaseDescription.length
            ? `description:\n  ${releaseDescription.split('\n').join('\n  ')}`
            : `empty description`
        core.info(`Creating a new release '${releaseVersion}' with Git tag: '${releaseTag}', and with ${description}`)

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
