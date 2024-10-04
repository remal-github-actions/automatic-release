import {incrementVersion} from './incrementVersion.js'
import {Version} from './Version.js'

describe('incrementVersion', () => {

    it('hasSuffix', () => {
        expect(() => incrementVersion(new Version('1-SNAPSHOT'), 'major')).toThrow(Error)
    })

    it('noNumbers', () => {
        expect(() => incrementVersion(new Version(''), 'major')).toThrow(Error)
        expect(() => incrementVersion(new Version('abc'), 'major')).toThrow(Error)
    })

    it('major', () => {
        expect(incrementVersion(new Version('1'), 'major').toString()).toBe('2')
    })

    it('minor', () => {
        expect(incrementVersion(new Version('1'), 'minor').toString()).toBe('1.1')
        expect(incrementVersion(new Version('1.0'), 'minor').toString()).toBe('1.1')
        expect(incrementVersion(new Version('1.1'), 'minor').toString()).toBe('1.2')
    })

    it('patch', () => {
        expect(incrementVersion(new Version('1'), 'patch').toString()).toBe('1.0.1')
        expect(incrementVersion(new Version('1.10'), 'patch').toString()).toBe('1.10.1')
        expect(incrementVersion(new Version('1.10.0'), 'patch').toString()).toBe('1.10.1')
        expect(incrementVersion(new Version('1.10.1'), 'patch').toString()).toBe('1.10.2')
    })

})
