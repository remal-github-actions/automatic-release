import {context} from '@actions/github'
import {Octokit} from './octokit'
import {Commit, PullRequestSimple} from './types'

export async function retrievePullRequestsAssociatedWithCommit(
    octokit: Octokit,
    commit: Commit
): Promise<PullRequestSimple[]> {
    return octokit.paginate(octokit.repos.listPullRequestsAssociatedWithCommit, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        commit_sha: commit.sha,
    })
}
