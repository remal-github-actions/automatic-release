import * as core from '@actions/core'
import {context} from '@actions/github'
import {Octokit} from './octokit'
import {Branch} from './types'
import {Version} from './Version'

export async function createRelease(
    octokit: Octokit,
    branch: Branch,
    releaseVersion: Version,
    releaseTag: string,
    releaseDescription: string
): Promise<void> {
    core.debug(`Creating a new release.`
        + ` Branch: '${branch.name}'.`
        + ` Release version: '${releaseVersion}'.`
        + ` Release tag: '${releaseTag}'.`
        + ` Release description: '${releaseDescription}'.`
    )
    await octokit.repos.createRelease({
        owner: context.repo.owner,
        repo: context.repo.repo,
        target_commitish: branch.name,
        tag_name: releaseTag,
        name: releaseVersion.toString(),
        body: releaseDescription,
    })
}
