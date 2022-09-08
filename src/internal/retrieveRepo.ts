import {context} from '@actions/github'
import {Octokit} from './octokit'
import {Repo} from './types'

export async function retrieveRepo(octokit: Octokit): Promise<Repo> {
    return octokit.repos.get({
        owner: context.repo.owner,
        repo: context.repo.repo,
    }).then(it => it.data)
}
