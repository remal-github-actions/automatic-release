import * as core from '@actions/core'
import {context} from '@actions/github'
import {Octokit} from './octokit'
import {VersionTag} from './types'
import {isVersionString, Version} from './Version'

export async function retrieveVersionTags(
    octokit: Octokit,
    versionTagPrefixes: string[] = []
): Promise<VersionTag[]> {
    core.debug(`Retrieving version tags.`
        + ` Version tag prefixes: '${versionTagPrefixes.join("', '")}'.`
    )
    const tags = await octokit.paginate(octokit.repos.listTags, {
        owner: context.repo.owner,
        repo: context.repo.repo,
    })

    const result: VersionTag[] = []
    const versionTagSortedPrefixes = [...versionTagPrefixes]
    versionTagSortedPrefixes.push('')
    versionTagSortedPrefixes.sort((o1, o2) => -1 * (o1.length - o2.length))
    for (const tag of tags) {
        let version: Version | undefined = undefined
        forEachTagVersionPrefix: for (const versionTagSortedPrefix of versionTagSortedPrefixes) {
            for (const prefix of [`${versionTagSortedPrefix}-`, versionTagSortedPrefix]) {
                if (tag.name.startsWith(prefix)) {
                    const potentialVersion = tag.name.substring(prefix.length)
                    if (isVersionString(potentialVersion)) {
                        version = Version.parse(potentialVersion)
                        if (version != null) {
                            break forEachTagVersionPrefix
                        }
                    }
                }
            }
        }
        if (version == null) {
            continue
        }

        result.push({
            version,
            tag,
        })
    }

    result.sort((o1, o2) => -1 * o1.version.compareTo(o2.version))

    return result
}

export async function retrieveLastVersionTag(
    octokit: Octokit,
    tagVersionPrefixes: string[] = []
): Promise<VersionTag | undefined> {
    return retrieveVersionTags(octokit, tagVersionPrefixes)
        .then(versionTags => {
            if (versionTags.length) {
                return versionTags[0]
            } else {
                return undefined
            }
        })
}
