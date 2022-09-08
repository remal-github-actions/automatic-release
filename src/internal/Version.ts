type SuffixToken = number | string

export class Version {

    static parse(value: unknown): Version | undefined {
        if (value == null) {
            return undefined
        }
        const text = (value as any).toString().trim()
        if (text.length === 0) {
            return undefined
        }
        return new Version(text)
    }


    private readonly _numbers: readonly number[]
    private readonly _suffix: string
    private readonly _suffixTokens: readonly SuffixToken[]

    constructor(version: string) {
        this._numbers = parseNumbers(version)
        this._suffix = parseSuffixString(version)
        this._suffixTokens = parseSuffixTokens(version)
    }

    toString() {
        return this._numbers.join('.') + this._suffix
    }

    get numbers(): readonly number[] {
        return [...this._numbers]
    }

    number(pos: number): number | undefined {
        if (pos < 1) {
            throw new Error(`pos must be greater or equal to 1: ${pos}`)
        }
        if (pos <= this._numbers.length) {
            return this._numbers[pos - 1]
        } else {
            return undefined
        }
    }

    get suffix(): string {
        return this._suffix
    }


    withNumbers(numbers: readonly number[]): Version {
        if (numbers.length === 0) {
            throw new Error('numbers must not be empty')
        }
        return new Version(numbers.join('.') + this._suffix)
    }

    withSuffix(suffix: string): Version {
        if (suffix.length === 0) {
            return new Version(this._numbers.join('.'))
        }
        const ch = suffix.substring(0, 1)
        if (('a' <= ch && ch <= 'z')
            || ('A' <= ch && ch <= 'Z')
            || ('0' <= ch && ch <= '9')
        ) {
            return new Version(`${this._numbers.join('.')}-${suffix}`)
        } else {
            return new Version(this._numbers.join('.') + suffix)
        }
    }

    withoutSuffix(): Version {
        if (this._suffix.length === 0) {
            return this
        } else {
            return new Version(this._numbers.join('.'))
        }
    }

    withNumber(pos: number, value: number): Version {
        if (pos < 1) {
            throw new Error(`pos must be greater or equal to 1: ${pos}`)
        }
        if (value < 0) {
            throw new Error(`value must be greater or equal to 0: ${value}`)
        }
        const newNumbers = [...this._numbers]
        for (let i = newNumbers.length; i < pos - 1; ++i) {
            newNumbers[i] = 0
        }
        newNumbers[pos - 1] = value
        return this.withNumbers(newNumbers)
    }

    withoutNumber(pos: number): Version {
        if (pos < 2) {
            throw new Error(`pos must be greater or equal to 2: ${pos}`)
        }
        if (pos > this._numbers.length) {
            return this
        }
        const newNumbers = [...this._numbers]
        newNumbers.splice(pos - 1)
        return this.withNumbers(newNumbers)
    }

    incrementNumber(pos: number, incrementer: number = 1) {
        const number = this.number(pos) || 0
        return this.withNumber(pos, number + incrementer)
    }


    compareTo(other: Version): number {
        let result = compareNumbers(this._numbers, other._numbers)
        if (result === 0) {
            result = compareSuffixTokens(this._suffixTokens, other._suffixTokens)
        }
        return result
    }


    get hasSuffix(): boolean {
        return this._suffixTokens.find(token => typeof token === 'string') !== undefined
    }

    get isRelease(): boolean {
        return !this.hasSuffix || getTokensOrder(this._suffixTokens) >= getTokensOrder(['release'])
    }

    get isSnapshot(): boolean {
        return getTokensOrder(this._suffixTokens) === getTokensOrder(['snapshot'])
    }

    get isRc(): boolean {
        return getTokensOrder(this._suffixTokens) === getTokensOrder(['rc'])
    }

    get isMilestone(): boolean {
        return getTokensOrder(this._suffixTokens) === getTokensOrder(['milestone'])
    }

    get isBeta(): boolean {
        return getTokensOrder(this._suffixTokens) === getTokensOrder(['beta'])
    }

    get isAlpha(): boolean {
        return getTokensOrder(this._suffixTokens) === getTokensOrder(['alpha'])
    }

}


export function compareVersions(version1: Version, version2: Version): number {
    return version1.compareTo(version2)
}

export function compareVersionsDesc(version1: Version, version2: Version): number {
    return -1 * compareVersions(version1, version2)
}


export const VERSION_REGEX = /^(?<numbers>\d+(\.\d+)*)(?<suffix>[-.+_a-z0-9]*)$/i

export function isVersionString(version: string): boolean {
    try {
        return matchVersion(version) != null
    } catch (e) {
        return false
    }
}

export function matchVersion(version: string): RegExpMatchArray {
    if (version.length === 0) {
        throw new Error('Version must not be empty')
    }

    const match = version.match(VERSION_REGEX)
    if (match == null) {
        throw new Error(`Version doesn't match to ${VERSION_REGEX}: ${version}`)
    }

    return match
}

export function parseNumbersString(version: string): string {
    const match = matchVersion(version)
    return match.groups!.numbers!
}

export function parseNumbers(version: string): number[] {
    const numbersString = parseNumbersString(version)
    return numbersString.split('.')
        .map(token => parseInt(token))
}

export function parseSuffixString(version: string): string {
    const match = matchVersion(version)
    return match.groups!.suffix || ''
}

const SPLIT_LETTER_FROM_DIGIT = /([a-z])(\d)/g
const SPLIT_DIGIT_FROM_LETTER = /(\d)([a-z])/g

export function parseSuffixTokens(version: string): SuffixToken[] {
    const suffix = parseSuffixString(version)
        .toLowerCase()
        .replace(SPLIT_LETTER_FROM_DIGIT, '$1-$2')
        .replace(SPLIT_DIGIT_FROM_LETTER, '$1-$2')

    return suffix.split(/[-.+_]/)
        .filter(token => token.length > 0)
        .map(token => {
            const number = parseInt(token)
            if (!isNaN(number)) {
                return number
            } else {
                return token
            }
        })
}


export function compareNumbers(numbers1: readonly number[], numbers2: readonly number[]): number {
    for (let i = 0; i < Math.min(numbers1.length, numbers2.length); ++i) {
        const number1 = numbers1[i]
        const number2 = numbers2[i]
        const result = number1 - number2
        if (result !== 0) {
            return result
        }
    }

    return numbers1.length - numbers2.length
}


export function compareSuffixTokens(tokens1: readonly SuffixToken[], tokens2: readonly SuffixToken[]): number {
    {
        const order1 = getTokensOrder(tokens1)
        const order2 = getTokensOrder(tokens2)
        const result = order1 - order2
        if (result !== 0) {
            return result
        }
    }

    for (let i = 0; i < Math.min(tokens1.length, tokens2.length); ++i) {
        const token1 = tokens1[i]
        const token2 = tokens2[i]
        if (typeof token1 === 'number' && typeof token2 === 'number') {
            const result = token1 - token2
            if (result !== 0) {
                return result
            }
        } else if (typeof token1 === 'number') {
            return 1
        } else if (typeof token2 === 'number') {
            return -1
        } else {
            if (token1 > token2) {
                return 1
            } else if (token1 < token2) {
                return -1
            }
        }
    }

    return tokens1.length - tokens2.length
}


const TOKENS_ORDER: { [key: string]: number } = {
    'sp': 2,

    'release': 1,
    'r': 1,
    'ga': 1,
    'final': 1,

    'snapshot': -1,

    'nightly': -2,

    'rc': -3,
    'cr': -3,

    'milestone': -4,
    'm': -4,

    'beta': -5,
    'b': -5,

    'alpha': -6,
    'a': -6,

    'dev': -7,
    'pr': -7,
}

export function getTokensOrder(tokens: readonly SuffixToken[]): number {
    for (const token of tokens) {
        if (typeof token === 'string') {
            const order = TOKENS_ORDER[token]
            if (order != null) {
                return order
            }
        }
    }
    return 0
}
