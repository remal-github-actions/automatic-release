import {VersionIncrementMode, versionIncrementModes} from './types'
import {Version} from './Version'

export function incrementVersion(version: Version, versionIncrementMode: VersionIncrementMode): Version {
    if (version.hasSuffix) {
        throw new Error(`Version has suffix: ${version}`)
    }

    const numbers = [...version.numbers]
    if (!numbers.length) {
        throw new Error(`Version doesn't have numbers: ${version}`)
    }

    function incrementNumber(index: number) {
        while (numbers.length <= index) {
            numbers.push(0)
        }

        ++numbers[index]
    }

    if (versionIncrementMode === 'major') {
        incrementNumber(0)

    } else if (versionIncrementMode === 'minor') {
        incrementNumber(1)

    } else if (versionIncrementMode === 'patch') {
        incrementNumber(2)

    } else {
        throw new Error(`Unsupported versionIncrementMode: '${versionIncrementMode}'.`
            + ` Only these values are supported: '${versionIncrementModes.join("', '")}'.`
        )
    }

    return new Version(numbers.join('.'))
}
