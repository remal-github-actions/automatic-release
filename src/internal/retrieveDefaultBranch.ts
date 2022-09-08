import {context} from '@actions/github'
import {Octokit} from './octokit'
import {Branch, Repo} from './types'

export async function retrieveDefaultBranch(octokit: Octokit, repo: Repo): Promise<Branch> {
    return octokit.repos.getBranch({
        owner: context.repo.owner,
        repo: context.repo.repo,
        branch: repo.default_branch,
    }).then(it => it.data)
}
