import * as core from '@actions/core'
import { context } from '@actions/github'
import picomatch from 'picomatch'
import { createRelease } from './internal/createRelease.js'
import { incrementVersion } from './internal/incrementVersion.js'
import { newOctokitInstance } from './internal/octokit.js'
import { retrieveCheckRuns } from './internal/retrieveCheckRuns.js'
import { retrieveCommitComparison } from './internal/retrieveCommitComparison.js'
import { retrieveDefaultBranch } from './internal/retrieveDefaultBranch.js'
import { retrievePullRequestsAssociatedWithCommit } from './internal/retrievePullRequestsAssociatedWithCommit.js'
import { retrieveRepo } from './internal/retrieveRepo.js'
import { retrieveLastVersionTag } from './internal/retrieveVersionTags.js'
import { ChangeLogItem, ChangeLogItemType, CheckRun, Commit, VersionIncrementMode } from './internal/types.js'
import { hasNotEmptyIntersection, onlyUnique } from './internal/utils.js'

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const githubToken = core.getInput('githubToken', { required: true })
const failOnNotAllowedCommits = core.getInput('failOnNotAllowedCommits', { required: true }).toLowerCase() === 'true'
const versionTagPrefix = core.getInput('versionTagPrefix', { required: false })
const allowedVersionTagPrefixes =
    core.getInput('allowedVersionTagPrefixes', { required: false })
        .split(/[\n\r,;]+/)
        .map(it => it.trim())
        .filter(it => it.length)
const expectedFilesToChange =
    core.getInput('expectedFilesToChange', { required: false })
        .split(/[\n\r,;]+/)
        .map(it => it.trim())
        .filter(it => it.length)
const ignoreExpectedFilesToChange =
    core.getInput('ignoreExpectedFilesToChange', { required: false }).toLowerCase() === 'true'
const allowedCommitPrefixes =
    core.getInput('allowedCommitPrefixes', { required: false })
        .split(/[\n\r,;]+/)
        .map(it => it.trim())
        .filter(it => it.length)
const allowedPullRequestLabels =
    core.getInput('allowedPullRequestLabels', { required: false })
        .split(/[\n\r,;]+/)
        .map(it => it.trim())
        .filter(it => it.length)
const skippedChangelogCommitPrefixes =
    core.getInput('skippedChangelogCommitPrefixes', { required: false })
        .split(/[\n\r,;]+/)
        .map(it => it.trim())
        .filter(it => it.length)
const dependencyUpdatesPullRequestLabels =
    core.getInput('dependencyUpdatesPullRequestLabels', { required: false })
        .split(/[\n\r,;]+/)
        .map(it => it.trim())
        .filter(it => it.length)
const dependencyUpdatesAuthors =
    core.getInput('dependencyUpdatesAuthors', { required: false })
        .split(/[\n\r,;]+/)
        .map(it => it.trim())
        .filter(it => it.length)
const miscPullRequestLabels =
    core.getInput('miscPullRequestLabels', { required: false })
        .split(/[\n\r,;]+/)
        .map(it => it.trim())
        .filter(it => it.length)
const versionIncrementMode =
    core.getInput('versionIncrementMode', { required: true }).toLowerCase() as VersionIncrementMode
const checkActorsAllowedToFail =
    core.getInput('checkActorsAllowedToFail', { required: false })
        .split(/[\n\r,;]+/)
        .map(it => it.trim())
        .filter(it => it.length)
checkActorsAllowedToFail.push(...dependencyUpdatesAuthors)
const actionPathsAllowedToFail =
    core.getInput('actionPathsAllowedToFail', { required: false })
        .split(/[\n\r,;]+/)
        .map(it => it.trim())
        .filter(it => it.length)
const dryRun = core.getInput('dryRun', { required: false }).toLowerCase() === 'true'

allowedVersionTagPrefixes.push(versionTagPrefix)

;[
    dependencyUpdatesPullRequestLabels,
    miscPullRequestLabels,
].flat().forEach(label => allowedPullRequestLabels.push(label))

const octokit = newOctokitInstance(githubToken)

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

async function run(): Promise<void> {
    try {
        core.debug(`failOnNotAllowedCommits=\`${failOnNotAllowedCommits}\``)
        core.debug(`versionTagPrefix=\`${versionTagPrefix}\``)
        core.debug(`allowedVersionTagPrefixes=\`${allowedVersionTagPrefixes.join('`, `')}\``)
        core.debug(`expectedFilesToChange=\`${expectedFilesToChange.join('`, `')}\``)
        core.debug(`ignoreExpectedFilesToChange=\`${ignoreExpectedFilesToChange}\``)
        core.debug(`allowedCommitPrefixes=\`${allowedCommitPrefixes.join('`, `')}\``)
        core.debug(`allowedPullRequestLabels=\`${allowedPullRequestLabels.join('`, `')}\``)
        core.debug(`skippedChangelogCommitPrefixes=\`${skippedChangelogCommitPrefixes.join('`, `')}\``)
        core.debug(`dependencyUpdatesPullRequestLabels=\`${dependencyUpdatesPullRequestLabels.join('`, `')}\``)
        core.debug(`dependencyUpdatesAuthors=\`${dependencyUpdatesAuthors.join('`, `')}\``)
        core.debug(`miscPullRequestLabels=\`${miscPullRequestLabels.join('`, `')}\``)
        core.debug(`versionIncrementMode=\`${versionIncrementMode}\``)
        core.debug(`checkActorsAllowedToFail=\`${checkActorsAllowedToFail.join('`, `')}\``)
        core.debug(`actionPathsAllowedToFail=\`${actionPathsAllowedToFail.join('`, `')}\``)
        core.debug(`dryRun=\`${dryRun}\``)


        const repo = await retrieveRepo(octokit)

        const lastVersionTag = await retrieveLastVersionTag(octokit, allowedVersionTagPrefixes)
        if (lastVersionTag == null) {
            core.warning(`Skipping release creation, as no version tags found for repository ${repo.html_url}`)
            return
        }
        core.info(`Last version: '${lastVersionTag.version}', tag: ${repo.html_url}/releases/tag/${lastVersionTag.tag.name}`)

        if (lastVersionTag.version.hasSuffix) {
            core.warning(`Skipping release creation, as last version has suffix: '${lastVersionTag.version}'`)
            return
        }

        const defaultBranch = await retrieveDefaultBranch(octokit, repo)
        const commitComparison = await retrieveCommitComparison(octokit, defaultBranch, lastVersionTag.tag)
        const commitComparisonCommits = commitComparison.commits ?? []
        if (!commitComparisonCommits.length) {
            core.info(`No commits found after last version tag: ${commitComparison.html_url}`)
            return
        }


        if (!ignoreExpectedFilesToChange) {
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
        }


        const checkRuns = await retrieveCheckRuns(octokit, defaultBranch.commit.sha)
        const allFailureCheckRuns = checkRuns.filter(it => ![
            'success',
            'neutral',
            'cancelled',
            'skipped',
            'action_required',
        ].includes(it.conclusion ?? ''))
        if (allFailureCheckRuns.length) {
            const currentWorkflowRun = await octokit.actions.getWorkflowRun({
                owner: context.repo.owner,
                repo: context.repo.repo,
                run_id: context.runId,
            }).then(it => it.data)

            const failureCheckRuns: CheckRun[] = []
            for (const checkRun of allFailureCheckRuns) {
                const currentCheckSuiteId = currentWorkflowRun.check_suite_id
                if (currentCheckSuiteId != null && checkRun.check_suite?.id === currentCheckSuiteId) {
                    core.info(`Ignoring failed ${checkRun.html_url} check run`
                        + `, as its Check Suite ID equals to the current Check Suite ID: ${currentCheckSuiteId}`,
                    )
                    continue
                }

                const appSlug = checkRun.app?.slug ?? ''
                if (checkActorsAllowedToFail.includes(appSlug)) {
                    core.info(`Ignoring failed ${checkRun.html_url} check run`
                        + `, as its app is allowed to fail: '${appSlug}'`,
                    )
                    continue
                }

                const currentRepoUrlPrefix = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/`
                let url = checkRun.html_url
                if (url != null) {
                    if (url.startsWith(currentRepoUrlPrefix)) {
                        url = url.substring(currentRepoUrlPrefix.length)
                    }
                    const actionRunMatch = url?.match(
                        /^actions\/runs\/(\d+)\/job\/(\d+)$/,
                    )
                    if (actionRunMatch != null) {
                        const actionRunId = actionRunMatch[1]
                        const actionRun = await octokit.actions.getWorkflowRun({
                            owner: context.repo.owner,
                            repo: context.repo.repo,
                            run_id: parseInt(actionRunId),
                        }).then(it => it.data)
                        if (checkActorsAllowedToFail.includes(actionRun.actor?.login ?? '')) {
                            core.info(`Ignoring failed ${checkRun.html_url} check run`
                                + `, as it's actor is allowed to fail: ${actionRun.path}`,
                            )
                            continue
                        }
                        if (actionPathsAllowedToFail.includes(actionRun.path)) {
                            core.info(`Ignoring failed ${checkRun.html_url} check run`
                                + `, as it's a part of GitHUb action that is allowed to fail: ${actionRun.path}`,
                            )
                            continue
                        }
                    }
                }
                failureCheckRuns.push(checkRun)
            }

            if (failureCheckRuns.length) {
                let message = `${failureCheckRuns.length} check run(s) not succeed for '${defaultBranch.name}' branch:`
                for (const checkRun of failureCheckRuns) {
                    message += `\n  ${checkRun.html_url}`
                    if (checkRun.output?.title != null) {
                        message += ` (${checkRun.output?.title})`
                    }
                    if (checkRun.conclusion != null) {
                        message += ` (${checkRun.conclusion})`
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
            pullRequestNumber: number | null | undefined = undefined,
        ) {
            core.info(`  Registering changelog item: ` + [
                `commit='${commit.sha}'`,
                `type='${type}'`,
                `message='${message}'`,
                `originalMessage='${originalMessage}'`,
                `author='${author}'`,
                `pullRequestNumber='${pullRequestNumber}'`,
            ].join(', '))

            message = message.trim()
            if (!message.length) {
                return
            }

            for (const skippedChangelogCommitPrefix of skippedChangelogCommitPrefixes) {
                if (originalMessage.startsWith(skippedChangelogCommitPrefix)) {
                    const messageAfterPrefix = originalMessage.substring(skippedChangelogCommitPrefix.length)
                    if (!messageAfterPrefix.trim().length
                        || messageAfterPrefix.match(/^\W/)
                        || skippedChangelogCommitPrefix.match(/\W$/)
                    ) {
                        core.info(`  Excluding changelog message by prefix '${skippedChangelogCommitPrefix}': ${originalMessage}`)
                        return
                    }
                }
            }

            if (author == null) {
                author = undefined
            }
            if (pullRequestNumber == null) {
                pullRequestNumber = undefined
            }

            const alreadyCreatedChangeLogItem = changeLogItems.find(item =>
                item.message === message && item.author === author,
            )
            if (alreadyCreatedChangeLogItem != null) {
                if (pullRequestNumber != null) {
                    if (!alreadyCreatedChangeLogItem.pullRequestNumbers.includes(pullRequestNumber)) {
                        alreadyCreatedChangeLogItem.pullRequestNumbers.push(pullRequestNumber)
                    }
                }
                if (!alreadyCreatedChangeLogItem.commits.some(it => it.sha === commit.sha)) {
                    alreadyCreatedChangeLogItem.commits.push(commit)
                }
                if (alreadyCreatedChangeLogItem.type == null) {
                    alreadyCreatedChangeLogItem.type = type
                }
            } else {
                changeLogItems.push({
                    message,
                    author: author ?? undefined,
                    pullRequestNumbers: pullRequestNumber != null ? [pullRequestNumber] : [],
                    commits: [commit],
                    type,
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
                        core.info(`Allowed commit by Pull Request label ('${allowedPullRequestLabel}'): ${message}: ${pullRequestAssociatedWithCommit.html_url}`
                            + ` (all labels: \`${labels.join('`, `')}\`)`,
                        )
                        let type: ChangeLogItemType | undefined = undefined
                        if (hasNotEmptyIntersection(labels, miscPullRequestLabels)) {
                            type = 'misc'
                        } else if (hasNotEmptyIntersection(labels, dependencyUpdatesPullRequestLabels)
                            || dependencyUpdatesAuthors.includes(pullRequestAssociatedWithCommit.user?.login ?? '')
                        ) {
                            type = 'dependency'
                        }
                        addChangelogItem(
                            commit,
                            type,
                            pullRequestAssociatedWithCommit.title,
                            pullRequestAssociatedWithCommit.title,
                            pullRequestAssociatedWithCommit.user?.login ?? undefined,
                            pullRequestAssociatedWithCommit.number,
                        )
                        continue forEachCommit
                    }
                }
            }

            for (const allowedCommitPrefix of allowedCommitPrefixes) {
                if (message.startsWith(allowedCommitPrefix)) {
                    const messageAfterPrefix = message.substring(allowedCommitPrefix.length)
                    if (!messageAfterPrefix.trim().length
                        || messageAfterPrefix.match(/^\W/)
                        || allowedCommitPrefix.match(/\W$/)
                    ) {
                        core.info(`Allowed commit by commit message prefix ('${allowedCommitPrefix}'): ${message}: ${commit.html_url}`)
                        let type: ChangeLogItemType | undefined = undefined
                        if (dependencyUpdatesAuthors.includes(commit.author?.name ?? '')) {
                            type = 'dependency'
                        }
                        addChangelogItem(
                            commit,
                            type,
                            messageAfterPrefix.trim().length
                                ? messageAfterPrefix.trim()
                                : message,
                            message,
                            commit.author?.name,
                        )
                        continue forEachCommit
                    }
                }
            }

            const failOnNotAllowedCommitMessage = `Not allowed commit: ${message}: ${commit.html_url}`
            if (failOnNotAllowedCommits) {
                throw new Error(failOnNotAllowedCommitMessage)
            } else {
                core.info(failOnNotAllowedCommitMessage)
                return
            }
        }


        if (!changeLogItems.length) {
            core.warning(`Skipping release creation, as no changelog items were collected`)
            return
        }


        const releaseVersion = incrementVersion(lastVersionTag.version, versionIncrementMode)

        const releaseTag = `${versionTagPrefix}${releaseVersion}`

        const releaseDescriptionLines: string[] = []
        releaseDescriptionLines.push(`_[Automatic release](${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId})_`)

        function appendChangeLogItemToReleaseDescriptionLines(changeLogItem: ChangeLogItem) {
            const tokens = [
                '*',
                changeLogItem.message,
            ]

            if (changeLogItem.pullRequestNumbers.length) {
                tokens.push(`(#${changeLogItem.pullRequestNumbers.join(', #')})`)
            } else {
                const commitHashes = changeLogItem.commits
                    .map(it => it.sha)
                    .filter(onlyUnique)
                if (commitHashes.length) {
                    tokens.push(`(${commitHashes.join(', ')})`)
                }
                const commitAuthors = changeLogItem.commits
                    .map(it => it.author?.login)
                    .filter(it => it?.length)
                    .map(it => it!.replace(/\[bot\]$/, ''))
                    .map(it => `@${it}`)
                    .filter(onlyUnique)
                if (commitAuthors.length) {
                    tokens.push(`${commitAuthors.join(', ')}`)
                }
            }

            if (changeLogItem.author != null) {
                tokens.push(`@${changeLogItem.author.replace(/\[bot\]$/, '')}`)
            }

            releaseDescriptionLines.push(tokens.join(' '))
        }

        const typeTitles: Record<ChangeLogItemType, string> = {
            'dependency': '📦 Dependency updates',
            'misc': '🛠️ Misc',
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


        const releaseDescription = releaseDescriptionLines.join('\n')
        const description = releaseDescription.length
            ? `description:\n  ${releaseDescription.split('\n').join('\n  ')}`
            : `empty description`
        core.info(`Creating a new release '${releaseVersion}' with Git tag '${releaseTag}' and with ${description}`)

        if (dryRun) {
            core.warning(`Skipping release creation, as dry run is enabled`)
            return
        }

        const createdRelease = await createRelease(
            octokit,
            defaultBranch,
            releaseVersion,
            releaseTag,
            releaseDescription,
        )
        core.info(`Created release: ${createdRelease.html_url}`)


    } catch (error) {
        core.setFailed(error instanceof Error ? error : `${error}`)
        throw error
    }
}

//noinspection JSIgnoredPromiseFromCall
run()
