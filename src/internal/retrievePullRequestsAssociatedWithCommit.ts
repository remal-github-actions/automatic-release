import * as core from '@actions/core'
import {context} from '@actions/github'
import {Octokit} from './octokit.js'
import {Commit, PullRequestSimple} from './types.js'

export async function retrievePullRequestsAssociatedWithCommit(
    octokit: Octokit,
    commit: Commit
): Promise<PullRequestSimple[]> {
    core.debug(`Retrieving Pull Requests associated with commit.`
        + ` Commit: '${commit.sha}'.`
    )
    return octokit.paginate(octokit.repos.listPullRequestsAssociatedWithCommit, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        commit_sha: commit.sha,
    })
}
