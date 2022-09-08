import {
    compareSuffixTokens,
    getTokensOrder,
    matchVersion,
    parseNumbers,
    parseNumbersString,
    parseSuffixString,
    parseSuffixTokens,
    Version,
    VERSION_REGEX
} from './Version'

describe('Version', () => {

    it('parse', () => {
        expect(Version.parse(null)).toBe(undefined)
        expect(Version.parse(undefined)).toBe(undefined)
        expect(Version.parse('')).toBe(undefined)
        expect(Version.parse(' ')).toBe(undefined)
        expect(Version.parse('1.2')?.toString()).toBe('1.2')
        expect(Version.parse('  1.2  ')?.toString()).toBe('1.2')
    })

    it('toString', () => {
        expect(new Version('1-snapshot2').toString()).toBe('1-snapshot2')
    })

    it('numbers', () => {
        expect(new Version('1.2-rc').numbers).toStrictEqual([1, 2])
    })

    it('number', () => {
        expect(() => new Version('1.2-rc').number(0)).toThrow('pos must be greater or equal to 1: 0')
        expect(new Version('1.2-rc').number(1)).toBe(1)
        expect(new Version('1.2-rc').number(2)).toBe(2)
        expect(new Version('1.2-rc').number(3)).toBeUndefined()
    })

    it('suffix', () => {
        expect(new Version('1.2-rc').suffix).toBe('-rc')
    })

    it('withNumbers', () => {
        expect(() => new Version('1.2-rc').withNumbers([])).toThrow('numbers must not be empty')
        expect(new Version('1.2-rc').withNumbers([3, 4]).toString()).toBe('3.4-rc')
    })

    it('withSuffix', () => {
        expect(new Version('1.2-rc').withSuffix('').toString()).toBe('1.2')
        expect(new Version('1.2-rc').withSuffix('alpha').toString()).toBe('1.2-alpha')
        expect(new Version('1.2-rc').withSuffix('.alpha').toString()).toBe('1.2.alpha')
    })

    it('withoutSuffix', () => {
        expect(new Version('1.2-rc').withoutSuffix().toString()).toBe('1.2')
    })

    it('withNumber', () => {
        expect(() => new Version('1.2-rc').withNumber(0, 5)).toThrow('pos must be greater or equal to 1: 0')
        expect(() => new Version('1.2-rc').withNumber(1, -1)).toThrow('value must be greater or equal to 0: -1')
        expect(new Version('1.2-rc').withNumber(1, 9).toString()).toBe('9.2-rc')
        expect(new Version('1.2-rc').withNumber(2, 9).toString()).toBe('1.9-rc')
        expect(new Version('1.2-rc').withNumber(3, 9).toString()).toBe('1.2.9-rc')
        expect(new Version('1.2-rc').withNumber(4, 9).toString()).toBe('1.2.0.9-rc')
    })

    it('withoutNumber', () => {
        expect(() => new Version('1.2-rc').withoutNumber(0)).toThrow('pos must be greater or equal to 2: 0')
        expect(() => new Version('1.2-rc').withoutNumber(1)).toThrow('pos must be greater or equal to 2: 1')
        expect(new Version('1.2-rc').withoutNumber(2).toString()).toBe('1-rc')
        expect(new Version('1.2-rc').withoutNumber(3).toString()).toBe('1.2-rc')
    })

    it('incrementNumber', () => {
        expect(() => new Version('1.2-rc').incrementNumber(0)).toThrow('pos must be greater or equal to 1: 0')
        expect(new Version('1.2-rc').incrementNumber(1).toString()).toBe('2.2-rc')
        expect(new Version('1.2-rc').incrementNumber(1, 10).toString()).toBe('11.2-rc')
        expect(new Version('1.2-rc').incrementNumber(2).toString()).toBe('1.3-rc')
        expect(new Version('1.2-rc').incrementNumber(2, 10).toString()).toBe('1.12-rc')
        expect(new Version('1.2-rc').incrementNumber(3).toString()).toBe('1.2.1-rc')
        expect(new Version('1.2-rc').incrementNumber(3, 10).toString()).toBe('1.2.10-rc')
        expect(new Version('1.2-rc').incrementNumber(4).toString()).toBe('1.2.0.1-rc')
        expect(new Version('1.2-rc').incrementNumber(4, 10).toString()).toBe('1.2.0.10-rc')
    })

    it('compareTo', () => {
        expect(new Version('1.2').compareTo(new Version('1.2.3'))).toBeLessThan(0)
        expect(new Version('1.2.3').compareTo(new Version('1.2'))).toBeGreaterThan(0)

        expect(new Version('1.2-snapshot').compareTo(new Version('1.2.3'))).toBeLessThan(0)
        expect(new Version('1.2.3').compareTo(new Version('1.2-snapshot'))).toBeGreaterThan(0)

        expect(new Version('1.2-snapshot').compareTo(new Version('1.2'))).toBeLessThan(0)
        expect(new Version('1.2').compareTo(new Version('1.2-snapshot'))).toBeGreaterThan(0)
    })

    it('hasSuffix', () => {
        expect(new Version('1')).toHaveProperty('hasSuffix', false)
        expect(new Version('1-token')).toHaveProperty('hasSuffix', true)
    })

    it('isRelease', () => {
        expect(new Version('1')).toHaveProperty('isRelease', true)
        expect(new Version('1-release')).toHaveProperty('isRelease', true)
        expect(new Version('1-r')).toHaveProperty('isRelease', true)
        expect(new Version('1-final')).toHaveProperty('isRelease', true)
        expect(new Version('1-ga')).toHaveProperty('isRelease', true)
        expect(new Version('1-sp')).toHaveProperty('isRelease', true)
    })

    it('isSnapshot', () => {
        expect(new Version('1')).toHaveProperty('isSnapshot', false)
        expect(new Version('1-SNAPSHOT')).toHaveProperty('isSnapshot', true)
        expect(new Version('1-SNAPSHOT2')).toHaveProperty('isSnapshot', true)
        expect(new Version('1-SNAPSHOT-2')).toHaveProperty('isSnapshot', true)
    })

    it('isRc', () => {
        expect(new Version('1')).toHaveProperty('isRc', false)
        expect(new Version('1-RC')).toHaveProperty('isRc', true)
        expect(new Version('1-rc2')).toHaveProperty('isRc', true)
        expect(new Version('1-rc-2')).toHaveProperty('isRc', true)
        expect(new Version('1-cr')).toHaveProperty('isRc', true)
        expect(new Version('1-cr2')).toHaveProperty('isRc', true)
        expect(new Version('1-cr-2')).toHaveProperty('isRc', true)
    })

    it('isMilestone', () => {
        expect(new Version('1')).toHaveProperty('isMilestone', false)
        expect(new Version('1-milestone')).toHaveProperty('isMilestone', true)
        expect(new Version('1-MILESTONE2')).toHaveProperty('isMilestone', true)
        expect(new Version('1-milestone-2')).toHaveProperty('isMilestone', true)
        expect(new Version('1-m')).toHaveProperty('isMilestone', true)
        expect(new Version('1-m2')).toHaveProperty('isMilestone', true)
        expect(new Version('1-m-2')).toHaveProperty('isMilestone', true)
    })

    it('isBeta', () => {
        expect(new Version('1')).toHaveProperty('isBeta', false)
        expect(new Version('1-beta')).toHaveProperty('isBeta', true)
        expect(new Version('1-beta2')).toHaveProperty('isBeta', true)
        expect(new Version('1-BETA-2')).toHaveProperty('isBeta', true)
        expect(new Version('1-b')).toHaveProperty('isBeta', true)
        expect(new Version('1-b2')).toHaveProperty('isBeta', true)
        expect(new Version('1-b-2')).toHaveProperty('isBeta', true)
    })

    it('isAlpha', () => {
        expect(new Version('1')).toHaveProperty('isAlpha', false)
        expect(new Version('1-alpha')).toHaveProperty('isAlpha', true)
        expect(new Version('1-alpha2')).toHaveProperty('isAlpha', true)
        expect(new Version('1-alpha-2')).toHaveProperty('isAlpha', true)
        expect(new Version('1-a')).toHaveProperty('isAlpha', true)
        expect(new Version('1-a2')).toHaveProperty('isAlpha', true)
        expect(new Version('1-a-2')).toHaveProperty('isAlpha', true)
    })

})

describe('matchVersion', () => {

    it('should fail on empty version string', function () {
        expect(() => matchVersion(''))
            .toThrow('Version must not be empty')
    })

    it('should fail on invalid version string', function () {
        expect(() => matchVersion('abc'))
            .toThrow(`Version doesn't match to ${VERSION_REGEX}: abc`)
    })

    it('should match valid versions', function () {
        expect(matchVersion('1.2-rc-3') != null)
            .toBeTruthy()
    })

})

describe('parseNumbersString', () => {

    it('should parse single digit version', function () {
        expect(parseNumbersString('1'))
            .toBe('1')
    })

    it('should parse digit-only version', function () {
        expect(parseNumbersString('1.2.3.4'))
            .toBe('1.2.3.4')
    })

    it('should parse suffixed version', function () {
        expect(parseNumbersString('1.2-3'))
            .toBe('1.2')
    })

    it('should parse Spring Framework-like release versions', () => {
        expect(parseNumbersString('1.2.3.RELEASE'))
            .toBe('1.2.3')
    })

})

describe('parseNumbers', () => {

    it('should parse single digit version', function () {
        expect(parseNumbers('1'))
            .toStrictEqual([1])
    })

    it('should parse digit-only version', function () {
        expect(parseNumbers('1.2.3.4'))
            .toStrictEqual([1, 2, 3, 4])
    })

    it('should parse suffixed version', function () {
        expect(parseNumbers('1.2-3'))
            .toStrictEqual([1, 2])
    })

})

describe('parseSuffixString', () => {

    it('should parse non-suffixed version', function () {
        expect(parseSuffixString('1'))
            .toBe('')
    })

    it('should parse canonical semver', () => {
        expect(parseSuffixString('1.2.3-rc.4'))
            .toBe('-rc.4')
    })

    it('should parse Spring Framework-like release versions', () => {
        expect(parseSuffixString('1.2.3.RELEASE'))
            .toBe('.RELEASE')
    })

})

describe('parseSuffixTokens', () => {

    it('should parse non-suffixed version', function () {
        expect(parseSuffixTokens('1'))
            .toStrictEqual([])
    })

    it('should transform version to lowercase', () => {
        expect(parseSuffixTokens('1-X'))
            .toStrictEqual(['x'])
    })

    it('should split letters and digits', () => {
        expect(parseSuffixTokens('1-rc10'))
            .toStrictEqual(['rc', 10])
    })

    it('should parse canonical semver', () => {
        expect(parseSuffixTokens('1.2.3-rc.4'))
            .toStrictEqual(['rc', 4])
    })

})

describe('compareNumbers', () => {

    it('should compare arrays of the same length correctly', () => {
        expect(compareSuffixTokens([1, 2], [1, 2])).toBe(0)
        expect(compareSuffixTokens([1, 3], [1, 2])).toBeGreaterThan(0)
        expect(compareSuffixTokens([1, 2], [1, 3])).toBeLessThan(0)
    })

    it('should treat longer arrays as greater', () => {
        expect(compareSuffixTokens([1, 2, 3], [1, 2])).toBeGreaterThan(0)
        expect(compareSuffixTokens([1, 2], [1, 2, 3])).toBeLessThan(0)
    })

})

describe('compareSuffixTokens', () => {

    it('should compare string tokens by order', () => {
        expect(compareSuffixTokens(['x', 'alpha'], ['y', 'beta'])).toBeLessThan(0)
        expect(compareSuffixTokens(['x', 'beta'], ['y', 'alpha'])).toBeGreaterThan(0)
    })

    it('should compare numbers tokens correctly', () => {
        expect(compareSuffixTokens(['x', 1], ['x', 2])).toBeLessThan(0)
        expect(compareSuffixTokens(['x', 2], ['x', 1])).toBeGreaterThan(0)
    })

    it('should treat numbers greater than strings', () => {
        expect(compareSuffixTokens(['x', 1], ['x', 'z'])).toBeGreaterThan(0)
        expect(compareSuffixTokens(['x', 'z'], ['x', 1])).toBeLessThan(0)
    })

    it('should compare string tokens with the same order alphabetically', () => {
        expect(compareSuffixTokens(['x'], ['y'])).toBeLessThan(0)
        expect(compareSuffixTokens(['y'], ['x'])).toBeGreaterThan(0)
    })

    it('should treat longer arrays as greater', () => {
        expect(compareSuffixTokens(['x', 0], ['x'])).toBeGreaterThan(0)
        expect(compareSuffixTokens(['x'], ['x', 0])).toBeLessThan(0)
    })

})

describe('getTokensOrder', () => {

    it('default', () => {
        expect(getTokensOrder([])).toBe(0)
        expect(getTokensOrder([1])).toBe(0)
        expect(getTokensOrder([''])).toBe(0)
        expect(getTokensOrder(['token'])).toBe(0)
    })

    it('sp', () => {
        expect(getTokensOrder(['sp'])).toBe(2)
    })

    it('release', () => {
        expect(getTokensOrder(['release'])).toBe(1)
        expect(getTokensOrder(['r'])).toBe(1)
    })

    it('ga', () => {
        expect(getTokensOrder(['ga'])).toBe(1)
    })

    it('final', () => {
        expect(getTokensOrder(['final'])).toBe(1)
    })

    it('snapshot', () => {
        expect(getTokensOrder(['snapshot'])).toBe(-1)
    })

    it('nightly', () => {
        expect(getTokensOrder(['nightly'])).toBe(-2)
    })

    it('rc', () => {
        expect(getTokensOrder(['rc'])).toBe(-3)
        expect(getTokensOrder(['cr'])).toBe(-3)
    })

    it('milestone', () => {
        expect(getTokensOrder(['milestone'])).toBe(-4)
        expect(getTokensOrder(['m'])).toBe(-4)
    })

    it('beta', () => {
        expect(getTokensOrder(['beta'])).toBe(-5)
        expect(getTokensOrder(['b'])).toBe(-5)
    })

    it('alpha', () => {
        expect(getTokensOrder(['alpha'])).toBe(-6)
        expect(getTokensOrder(['a'])).toBe(-6)
    })

    it('dev', () => {
        expect(getTokensOrder(['dev'])).toBe(-7)
    })

    it('pr', () => {
        expect(getTokensOrder(['pr'])).toBe(-7)
    })

})
