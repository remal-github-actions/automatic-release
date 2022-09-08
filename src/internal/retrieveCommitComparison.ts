import {context} from '@actions/github'
import {Octokit} from './octokit'
import {Branch, CommitComparison, Tag} from './types'

export async function retrieveCommitComparison(octokit: Octokit, branch: Branch, tag: Tag): Promise<CommitComparison> {
    return octokit.paginate(octokit.repos.compareCommitsWithBasehead, {
        owner: context.repo.owner,
        repo: context.repo.repo,
        basehead: `${tag.name}..${branch.commit.sha}`,
    })
}
