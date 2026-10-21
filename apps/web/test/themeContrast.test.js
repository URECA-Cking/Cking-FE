import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

/** 지정한 선택자의 CSS 블록 안에서 --color-* 변수들을 { 이름: [r, g, b] }로 읽는다. */
function readTokens(selector) {
  const start = css.indexOf(`${selector} {`)
  assert.ok(start >= 0, `${selector} 블록을 찾을 수 없다`)
  const end = css.indexOf('\n  }', start)
  const tokens = {}
  for (const [, name, r, g, b] of css.slice(start, end).matchAll(/--color-([a-z-]+): (\d+) (\d+) (\d+);/g)) {
    tokens[name] = [Number(r), Number(g), Number(b)]
  }
  return tokens
}

/** 상대 휘도(WCAG)를 계산한다. */
function luminance([r, g, b]) {
  const channel = (value) => {
    const unit = value / 255
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** 두 색의 명암 대비(1~21)를 계산한다. */
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

/** 배경 위에 전경색을 알파 비율로 올린 결과 색을 돌려준다(옅은 색 배경 계산용). */
function blend(foreground, background, alpha) {
  return foreground.map((value, index) => Math.round(value * alpha + background[index] * (1 - alpha)))
}

const THEMES = { 다크: readTokens(':root'), 라이트: readTokens(":root[data-theme='light']") }
// 강조·성공 글씨가 놓이는 카드 배경. 웰컴 퀘스트 카드는 surface-container, 퀴즈는 lowest에서 시작하는 그라데이션이다.
const SURFACES = ['surface-container', 'surface-container-lowest']
// 옅은 색 배경의 알파. 글씨가 놓이는 보너스 상자는 10%, 글씨 없이 아이콘만 놓이는 STEP 3 아이콘 칸은 20%다.
const TEXT_TINT_ALPHA = 0.1
const ICON_TINT_ALPHA = 0.2

for (const [themeName, tokens] of Object.entries(THEMES)) {
  for (const textToken of ['warm-accent', 'success-text']) {
    for (const surfaceName of SURFACES) {
      test(`${themeName} 모드에서 ${textToken} 글씨는 ${surfaceName} 위에서 대비 4.5 이상이다`, () => {
        assert.ok(tokens[textToken], `${textToken} 토큰이 있어야 한다`)
        assert.ok(contrast(tokens[textToken], tokens[surfaceName]) >= 4.5, `${themeName} ${textToken}/${surfaceName} = ${contrast(tokens[textToken], tokens[surfaceName]).toFixed(2)}`)
      })
    }
  }

  // 라이트의 outline은 서브 카드·입력 영역 위 보조 정보 글씨로 쓰인다. 다크 outline은 기존 디자인 값을 유지해 검사하지 않는다.
  if (themeName === '라이트') {
    for (const surfaceName of ['surface-container', 'surface-container-low', 'surface-container-lowest']) {
      test(`라이트 모드에서 outline 글씨는 ${surfaceName} 위에서 대비 4.5 이상이다`, () => {
        assert.ok(contrast(tokens.outline, tokens[surfaceName]) >= 4.5, `라이트 outline/${surfaceName} = ${contrast(tokens.outline, tokens[surfaceName]).toFixed(2)}`)
      })
    }
  }

  test(`${themeName} 모드에서 warm-accent 글씨는 10% 옅은 배경 위에서도 대비 4.5 이상이고, 아이콘은 20% 배경 위에서 대비 3 이상이다`, () => {
    for (const surfaceName of SURFACES) {
      const textBackground = blend(tokens['warm-accent'], tokens[surfaceName], TEXT_TINT_ALPHA)
      const textRatio = contrast(tokens['warm-accent'], textBackground)
      assert.ok(textRatio >= 4.5, `${themeName} ${surfaceName} 글씨 = ${textRatio.toFixed(2)}`)
      const iconBackground = blend(tokens['warm-accent'], tokens[surfaceName], ICON_TINT_ALPHA)
      const iconRatio = contrast(tokens['warm-accent'], iconBackground)
      assert.ok(iconRatio >= 3, `${themeName} ${surfaceName} 아이콘 = ${iconRatio.toFixed(2)}`)
    }
  })
}
