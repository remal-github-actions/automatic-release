import * as core from '@actions/core'
import {context} from '@actions/github'
import {Octokit} from './octokit'
import {Repo} from './types'

export async function retrieveRepo(octokit: Octokit): Promise<Repo> {
    core.debug(`Retrieving repository info`)
    return octokit.repos.get({
        owner: context.repo.owner,
        repo: context.repo.repo,
    }).then(it => it.data)
}
