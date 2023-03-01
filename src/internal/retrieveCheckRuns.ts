import { context } from '@actions/github'
import { Octokit } from './octokit'
import { CheckRun, CommitSha } from './types'

export async function retrieveCheckRuns(octokit: Octokit, commitSha: CommitSha): Promise<CheckRun[]> {
    return octokit.paginate(octokit.checks.listForRef, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: commitSha,
        filter: 'latest',
    })
}
