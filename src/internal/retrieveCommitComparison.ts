import * as core from '@actions/core'
import {context} from '@actions/github'
import {Octokit} from './octokit'
import {Branch, CommitComparison, Tag} from './types'

export async function retrieveCommitComparison(octokit: Octokit, branch: Branch, tag: Tag): Promise<CommitComparison> {
    core.debug(`Retrieving commit comparison.`
        + ` Branch: '${branch.name}'.`
        + ` Tag: '${tag.name}'.`
    )
    return octokit.paginate(octokit.repos.compareCommitsWithBasehead, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        basehead: `${tag.commit.sha}...${branch.commit.sha}`,
    })
}
