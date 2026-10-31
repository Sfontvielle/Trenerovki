import ts from 'typescript';

import { english } from '@/lib/i18n-en';

type DirectoryEntry = { name: string; isDirectory(): boolean };

const fs = jest.requireActual('node:fs') as {
  readdirSync(path: string, options: { withFileTypes: true }): DirectoryEntry[];
  readFileSync(path: string, encoding: 'utf8'): string;
};

const CYRILLIC = /[А-Яа-яЁё]/;
const UNTRANSLATED = ['src/lib/i18n-en.ts', 'src/app/design-system.tsx'];

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function isTranslationCall(node: ts.Node) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't';
}

function scan(file: string) {
  const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const keys: string[] = [];
  const bare: string[] = [];

  const visit = (node: ts.Node) => {
    if (isTranslationCall(node)) {
      const [first, values] = (node as ts.CallExpression).arguments;
      if (first && ts.isStringLiteralLike(first)) {
        keys.push(first.text);
      }
      if (values) {
        visit(values);
      }
      return;
    }
    if ((ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node)) && CYRILLIC.test(node.text)) {
      bare.push(node.text.trim());
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return { keys, bare };
}

const files = sourceFiles('src').filter((file) => !UNTRANSLATED.includes(file));
const scanned = files.map((file) => ({ file, ...scan(file) }));

function placeholders(text: string) {
  return (text.match(/\{\d+\}/g) ?? []).sort();
}

describe('translations', () => {
  it('has English for every string on screen', () => {
    const missing = scanned.flatMap(({ keys }) => keys.filter((key) => !(key in english)));

    expect(missing).toEqual([]);
  });

  it('leaves no Russian text outside the translation call', () => {
    const bare = scanned.flatMap(({ file, bare: texts }) =>
      file === 'src/lib/format.ts' ? texts.filter((text) => text !== 'ё' && text !== 'е') : texts,
    );

    expect(bare).toEqual([]);
  });

  it('keeps placeholders intact', () => {
    for (const [key, value] of Object.entries(english)) {
      expect([key, placeholders(value)]).toEqual([key, placeholders(key)]);
    }
  });

  it('keeps no stale translations', () => {
    const used = new Set(scanned.flatMap(({ keys }) => keys));

    expect(Object.keys(english).filter((key) => !used.has(key))).toEqual([]);
  });

  it('keeps Cyrillic out of the English text', () => {
    expect(Object.values(english).filter((value) => CYRILLIC.test(value))).toEqual([]);
  });
});

describe('language at runtime', () => {
  function loadWith(languageCode: string) {
    jest.resetModules();
    jest.doMock('expo-localization', () => ({ getLocales: () => [{ languageCode }] }));
    return { i18n: require('@/lib/i18n'), format: require('@/lib/format') };
  }

  afterEach(() => {
    jest.dontMock('expo-localization');
    jest.resetModules();
  });

  it('follows the phone language and falls back to English', () => {
    expect(loadWith('ru').i18n.t('Начать')).toBe('Начать');
    expect(loadWith('en').i18n.t('Начать')).toBe('Get started');
    expect(loadWith('de').i18n.t('Начать')).toBe('Get started');
  });

  it('fills placeholders in both languages', () => {
    expect(loadWith('ru').i18n.t('{0} ккал', { 0: 100 })).toBe('100 ккал');
    expect(loadWith('en').i18n.t('{0} ккал', { 0: 100 })).toBe('100 kcal');
  });

  it('formats numbers and plurals for the language', () => {
    const { format } = loadWith('en');

    expect(format.formatInputNumber(62.5)).toBe('62.5');
    expect(format.formatNumber(1500)).toBe('1,500');
    expect(format.pluralize(1, ['set', 'sets', 'sets'])).toBe('set');
    expect(format.pluralize(3, ['set', 'sets', 'sets'])).toBe('sets');
    expect(format.parseDecimal('62,5')).toBe(62.5);
  });
});
