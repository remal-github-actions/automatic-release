import { context } from '@actions/github'
import { Octokit } from './octokit.js'
import { CheckRun, CommitSha } from './types.js'

export async function retrieveCheckRuns(octokit: Octokit, commitSha: CommitSha): Promise<CheckRun[]> {
    return octokit.paginate(octokit.checks.listForRef, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: commitSha,
        filter: 'latest',
    })
}
