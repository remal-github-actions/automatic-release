import { context } from '@actions/github'
import { Octokit } from './octokit.js'
import { Commit, CommitSha } from './types.js'

export async function retrieveCommit(octokit: Octokit, commitSha: CommitSha): Promise<Commit> {
    return octokit.repos.getCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: commitSha,
    }).then(it => it.data)
}
