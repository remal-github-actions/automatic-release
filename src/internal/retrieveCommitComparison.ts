import * as core from '@actions/core'
import {context} from '@actions/github'
import {Octokit} from './octokit'
import {Branch, CommitComparison, Tag} from './types'

export async function retrieveCommitComparison(octokit: Octokit, branch: Branch, tag: Tag): Promise<CommitComparison> {
    const perPage = 100
    core.debug(`Retrieving commit comparison.`
        + ` Branch: '${branch.name}'.`
        + ` Tag: '${tag.name}'.`
        + ` Commits per page: '${perPage}'.`
        + ` Page: '1'.`
    )
    const commitComparison = await octokit.repos.compareCommitsWithBasehead({
        owner: context.repo.owner,
        repo: context.repo.repo,
        basehead: `${tag.commit.sha}...${branch.commit.sha}`,
        page: 1,
        per_page: perPage,
    }).then(it => it.data)
    commitComparison.commits = commitComparison.commits || []
    let lastLoadedCommitsCount = commitComparison.commits.length
    core.debug(`  lastLoadedCommitsCount = ${lastLoadedCommitsCount}`)
    for (let page = 2; lastLoadedCommitsCount >= perPage; ++page) {
        core.debug(`Retrieving commit comparison.`
            + ` Branch: '${branch.name}'.`
            + ` Tag: '${tag.name}'.`
            + ` Commits per page: '${perPage}'.`
            + ` Page: '${page}'.`
        )
        const pageCommitComparison = await octokit.repos.compareCommitsWithBasehead({
            owner: context.repo.owner,
            repo: context.repo.repo,
            basehead: `${tag.commit.sha}...${branch.commit.sha}`,
            page,
            per_page: perPage,
        }).then(it => it.data)
        pageCommitComparison.commits = pageCommitComparison.commits || []
        pageCommitComparison.commits.forEach(commit => commitComparison.commits.push(commit))
        lastLoadedCommitsCount = pageCommitComparison.commits.length
        core.debug(`  lastLoadedCommitsCount = ${lastLoadedCommitsCount}`)
    }
    return commitComparison
}
