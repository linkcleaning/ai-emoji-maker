// ─────────────────────────────────────────────────────────────
// 프롬프트 엔진: 카테고리 × 스타일 × 감정 12종 → 영문 프롬프트
// ─────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { id: 'person', label: '인물', emoji: '🙂' },
  { id: 'cat', label: '고양이', emoji: '🐱' },
  { id: 'dog', label: '강아지', emoji: '🐶' },
];

export const STYLES = [
  { id: '3d', label: '3D 피규어풍', desc: '큰 눈망울 · 말랑한 3D 치비' },
  { id: '2d', label: '2D 감성 카툰풍', desc: '수채화 · 일상 공감툰' },
];

// 12종 감정/상황. person = 사람 포즈, pet = 반려동물 포즈(샘플 고양이 일상툰 느낌)
export const EMOTIONS = [
  {
    id: 'hello', label: '인사/기쁨', text: '안녕!', icon: '👋',
    person: 'beaming with a big open-mouth smile, waving both hands at the viewer, small sparkle lines around the hands',
    pet: 'beaming happily, sitting up and waving one front paw high at the viewer, small sparkle lines',
  },
  {
    id: 'love', label: '사랑/고마움', text: '고마워♥', icon: '🥰',
    person: 'eyes closed in a blissful smile, hugging a big glossy red heart to the chest, tiny hearts floating around',
    pet: 'eyes closed in a blissful smile, hugging a big glossy red heart with both front paws, tiny hearts floating around',
  },
  {
    id: 'fighting', label: '응원/파이팅', text: '파이팅!', icon: '💪',
    person: 'winking with a confident grin, one fist clenched and raised high, small yellow sparkle stars',
    pet: 'winking with a determined face, one front paw clenched and raised high like a fist, small yellow sparkle stars',
  },
  {
    id: 'panic', label: '멘붕/당황', text: '멘붕...', icon: '😱',
    person: 'both hands clutching the head, eyes wide and shaking, big blue sweat drops flying, little swirl lines',
    pet: 'both front paws pressed on the head, eyes wide in shock, fur slightly puffed up, big blue sweat drops flying',
  },
  {
    id: 'angry', label: '분노/화남', text: '흥!', icon: '😤',
    person: 'cheeks puffed out and flushed red, brows deeply furrowed, pouting, a red anger-vein symbol near the head, small steam puffs',
    pet: 'cheeks puffed out and flushed red, glaring with furrowed brows, a red anger-vein symbol near the head, small steam puffs',
  },
  {
    id: 'sad', label: '슬픔/눈물', text: '엉엉', icon: '😭',
    person: 'crying loudly with mouth wide open, two waterfalls of tears streaming down, clutching a crumpled tissue',
    pet: 'crying loudly with streams of tears, holding a crumpled tissue in one paw, ears drooping',
  },
  {
    id: 'tired', label: '피곤/방전', text: '방전...', icon: '🫠',
    person: 'exhausted with heavy dark circles and half-closed eyes, slumped over a small desk with an open laptop, a coffee cup hanging on an IV drip stand beside them',
    pet: 'exhausted with half-closed eyes and round glasses, typing on a small laptop, a takeaway coffee cup hanging on an IV drip stand with a tube connected to the paw',
  },
  {
    id: 'question', label: '궁금/물음표', text: '응?', icon: '❓',
    person: 'head tilted to one side, index finger on the chin, round curious eyes, a white speech bubble with a big "?" above the head',
    pet: 'head tilted to one side, round curious eyes, a white speech bubble with a big "?" above the head',
  },
  {
    id: 'party', label: '축하/파티', text: '축하해!', icon: '🎉',
    person: 'wearing a striped party cone hat, laughing while popping a party popper, colorful confetti and streamers bursting',
    pet: 'wearing a striped party cone hat, cheering while a party popper bursts colorful confetti and streamers',
  },
  {
    id: 'sleep', label: '수면/기절', text: '쿨쿨', icon: '😴',
    person: 'sound asleep with cheek on a fluffy white pillow, a little drool and a snot bubble, "Zzz" letters floating above',
    pet: 'sprawled belly-up fast asleep on a fluffy pillow, paws in the air, a snot bubble, "Zzz" letters floating above',
  },
  {
    id: 'cool', label: '도도/쿨함', text: '후훗', icon: '😎',
    person: 'wearing black sunglasses, arms crossed, chin up with a smug confident smirk, a small yellow star sparkle',
    pet: 'wearing black sunglasses, arms crossed, chin up with a smug cool expression, a small yellow star sparkle',
  },
  {
    id: 'ok', label: '확인/오케이', text: 'OK!', icon: '👍',
    person: 'big cheerful smile giving an enthusiastic thumbs up, a small hand-lettered "OK!" next to the hand',
    pet: 'big cheerful smile giving a thumbs up with one paw, a small hand-lettered "OK!" next to it',
  },
];

const STYLE_TEXT = {
  '3d':
    '3D rendered cute chibi figurine style, Pixar-like proportions with an oversized head (about 1:1.3 head to body), ' +
    'big glossy expressive eyes with catchlights, rosy blushed cheeks, soft subsurface-scattering skin, ' +
    'smooth matte vinyl-toy texture, soft diffused studio lighting, warm pastel tones, highly detailed hair strands, ' +
    'clean high quality render',
  '2d':
    'warm hand-drawn 2D cartoon illustration, soft brown ink outlines with a slight hand-drawn wobble, ' +
    'gentle watercolor and colored-pencil shading, warm cream, peach and caramel palette, chubby round soft body, ' +
    'relatable daily-life office-worker comic vibe like a Korean webtoon sticker, minimal props, cozy and humorous',
};

const SUBJECT_TEXT = {
  person:
    'Turn the person in the reference photo into a chibi character. Preserve their identity: exact hairstyle and hair color, ' +
    'face shape, eye shape and color, eyebrows, glasses if present, moles or beauty marks, earrings/accessories, and outfit colors. ' +
    'Bust-up framing (head, shoulders, hands and upper body).',
  cat:
    'Turn the cat in the reference photo into a chubby cute cat character. Preserve exactly: fur base color, stripe/tabby pattern and ' +
    'patch placement, white areas, eye color, ear shape, nose color and tail. Full body, cute cat anatomy with expressive human-like poses.',
  dog:
    'Turn the dog in the reference photo into a chubby cute puppy character. Preserve exactly: breed look, fur color and markings, ' +
    'ear shape (floppy or pointy), eye color, nose, muzzle shape, collar if present. Full body, cute puppy anatomy with expressive human-like poses.',
};

/**
 * 배경/테두리 지시문
 * - chroma: Gemini 등 투명 PNG를 못 주는 모델 → 단색 크로마 배경 요청, 앱이 자동으로 지우고 다이컷 테두리 합성
 * - transparent: OpenAI gpt-image 계열 → 투명 배경 직접 요청, 앱이 다이컷 테두리 합성
 * - baked: 후처리 끔 → 모델이 흰 테두리+그림자까지 그리게 함
 */
function backgroundText(mode) {
  if (mode === 'chroma')
    return 'BACKGROUND: perfectly flat solid pure chroma-key green (#00FF00) filling the entire canvas edge to edge — the green must touch all four edges of the image. ' +
      'No rectangle, card, paper, panel, border line or frame around the image or the character. No gradient, no floor, no cast shadow, no scenery. ' +
      'Do NOT draw any white sticker outline or border around the character (it is added in post-production). ' +
      'Do not use any green color on the character or props (if the subject wears green clothing, render it in navy or beige instead). No glow, halo, outline or soft shadow around the character — the character edge must meet the flat green directly.';
  if (mode === 'transparent')
    return 'BACKGROUND: fully transparent. Do NOT draw any white sticker outline or border (added in post-production). No cast shadow.';
  return 'Die-cut sticker look: thick clean white border following the silhouette, soft subtle drop shadow, on a plain light beige background.';
}

const COMMON =
  'Exactly ONE character, centered, the whole character and all props fully inside the image with comfortable margin, ' +
  'no floating bars, lines, frames, banners, buttons, UI elements or empty speech bubbles (only the props described), ' +
  'nothing cropped. Bold readable silhouette that works at small messenger-sticker size. No extra text except the symbols described, ' +
  'no watermark, no signature, no frame, no panel borders.';

export function buildStickerPrompt({ category, style, emotion, bgMode, hasAnchor, fixFrame }) {
  const pose = category === 'person' ? emotion.person : emotion.pet;
  return [
    'Create a single character illustration (a cut-out) on a flat green chroma-key background. It will be turned into a chat emoji later by software.',
    fixFrame ? 'IMPORTANT: the previous attempt wrongly drew a box/card/frame around the picture. Do NOT draw any box, card, rectangle or frame — only the character floating on pure green that reaches every edge.' : '',
    `STYLE: ${STYLE_TEXT[style]}.`,
    `SUBJECT: ${SUBJECT_TEXT[category]}`,
    hasAnchor
      ? 'CONSISTENCY: Image 1 is the original photo. Image 2 is the already-designed character for this sticker pack — draw the EXACT SAME character design (same face, proportions, colors, markings, outfit and rendering style). Only the expression and pose change.'
      : 'CONSISTENCY: this is the first sticker of a 12-sticker pack, so establish a clear, appealing, reusable character design.',
    `EXPRESSION & POSE (${emotion.label}): ${pose}.`,
    COMMON,
    backgroundText(bgMode),
    'Square 1:1 composition, crisp, high quality, 4k detail.',
  ].filter(Boolean).join('\n');
}

/** 한 장짜리 4행×3열 시트 프롬프트 (빠름·저렴 모드) */
export function buildSheetPrompt({ category, style, bgMode, emotions = EMOTIONS }) {
  const list = emotions.map((e, i) => `${i + 1}. ${e.label.split('/')[1] || e.label}: ${category === 'person' ? e.person : e.pet}`).join('\n');
  return [
    'A set of 12 distinct emoji stickers of the SAME character, arranged as a sticker sheet in a strict grid of 3 columns × 4 rows,',
    'equal-sized cells, each sticker centered in its own cell with wide empty gaps between stickers so no two stickers touch.',
    `STYLE: ${STYLE_TEXT[style]}.`,
    `SUBJECT: ${SUBJECT_TEXT[category]}`,
    'Keep the character design perfectly consistent across all 12 stickers; only expression and pose change.',
    'Order left-to-right, top-to-bottom:',
    list,
    'No grid lines, no numbers, no captions, no watermark.',
    backgroundText(bgMode),
    'High quality, 4k detail.',
  ].join('\n');
}
