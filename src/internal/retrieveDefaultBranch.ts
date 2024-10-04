import * as core from '@actions/core'
import {context} from '@actions/github'
import {Octokit} from './octokit.js'
import {Branch, Repo} from './types.js'

export async function retrieveDefaultBranch(octokit: Octokit, repo: Repo): Promise<Branch> {
    core.debug(`Retrieving default branch`)
    return octokit.repos.getBranch({
        owner: context.repo.owner,
        repo: context.repo.repo,
        branch: repo.default_branch,
    }).then(it => it.data)
}
