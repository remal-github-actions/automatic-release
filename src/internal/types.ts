import type { components } from '@octokit/openapi-types'
import { Version } from './Version.js'

export type Repo = components['schemas']['full-repository']
export type CommitSha = string
export type CheckRun = components['schemas']['check-run']
export type CheckSuite = components['schemas']['check-suite']
export type CommitComparison = components['schemas']['commit-comparison']
export type Tag = components['schemas']['tag']
export type Commit = components['schemas']['commit']
export type Branch = components['schemas']['branch-short']
export type PullRequestSimple = components['schemas']['pull-request-simple']
export type Release = components['schemas']['release']

export const versionIncrementModes = [
    'major',
    'minor',
    'patch',
] as const

export type VersionIncrementMode = typeof versionIncrementModes[number]

export interface VersionTag {
    version: Version
    tag: Tag
}

export interface CommitPullRequest {
    commit: Commit
    pullRequest: PullRequestSimple
}

export type ChangeLogItemType = 'dependency'

export interface ChangeLogItem {
    message: string
    author?: string
    pullRequestNumbers: number[]
    commits: CommitSha[]
    type?: ChangeLogItemType
}
