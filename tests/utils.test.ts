import { getWorkspace, getCacheTagPrefix, wasCacheHit } from '../lib/utils';
import * as core from '@actions/core';

describe('Rust Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BORINGCACHE_DEFAULT_WORKSPACE;
    delete process.env.GITHUB_REPOSITORY;
  });

  describe('getWorkspace', () => {
    it('should return input workspace when provided', () => {
      expect(getWorkspace('my-org/my-project')).toBe('my-org/my-project');
    });

    it('should use BORINGCACHE_DEFAULT_WORKSPACE as fallback', () => {
      process.env.BORINGCACHE_DEFAULT_WORKSPACE = 'default-org/default-project';
      expect(getWorkspace('')).toBe('default-org/default-project');
    });

    it('should add default/ prefix when no slash present', () => {
      expect(getWorkspace('my-project')).toBe('default/my-project');
    });

    it('should fail when no workspace available', () => {
      expect(() => getWorkspace('')).toThrow('Workspace required');
      expect(core.setFailed).toHaveBeenCalled();
    });
  });

  describe('getCacheTagPrefix', () => {
    it('should return input cache tag when provided', () => {
      expect(getCacheTagPrefix('my-cache')).toBe('my-cache');
    });

    it('should use repository name as default', () => {
      process.env.GITHUB_REPOSITORY = 'owner/my-repo';
      expect(getCacheTagPrefix('')).toBe('my-repo');
    });

    it('should return rust as final fallback', () => {
      expect(getCacheTagPrefix('')).toBe('rust');
    });
  });

  describe('wasCacheHit', () => {
    it('should return false for non-zero exit code', () => {
      expect(wasCacheHit(1)).toBe(false);
    });

    it('should return true for zero exit code with no output', () => {
      expect(wasCacheHit(0)).toBe(true);
    });
  });
});
