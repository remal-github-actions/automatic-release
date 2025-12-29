import { context } from '@actions/github'
import { Octokit } from './octokit.js'
import { Release } from './types.js'

export async function retrieveRelease(octokit: Octokit, tagName: string): Promise<Release | undefined> {
    return octokit.repos.getReleaseByTag({
        owner: context.repo.owner,
        repo: context.repo.repo,
        tag: tagName,
    })
        .then(it => it.data)
        .catch(err => {
            if (err?.status === 404) {
                return undefined
            }
            throw err
        })
}
