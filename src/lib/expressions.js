// ─────────────────────────────────────────────────────────────
// 표정 라이브러리 · 테마 팩 · 직접 입력
// 각 표정: id, label(이름), text(크게 보기 문구), icon, person(사람 포즈), pet(반려동물 포즈), demo(데모 그림 번호)
// ─────────────────────────────────────────────────────────────
import { EMOTIONS } from './prompts.js';

const e = (id, label, text, icon, person, pet, demo) => ({ id, label, text, icon, person, pet: pet || person, demo });

// 기본 12종에 데모 그림 번호 부여
const BASIC = EMOTIONS.map((x, i) => ({ ...x, demo: i }));

const OFFICE = [
  e('commute', '출근길', '출근 중…', '🚇', 'sleepy half-closed eyes, holding a subway hand strap with one hand and a briefcase in the other, ID badge on a lanyard', 'sleepy face, hanging from a subway hand strap with one paw, ID badge on a lanyard, tiny briefcase', 6),
  e('coffee', '커피 수혈', '커피 수혈 중', '☕', 'clutching a huge takeaway coffee cup with both hands and sipping through a straw with desperate eyes', null, 6),
  e('yes_sir', '넵!', '넵!', '🫡', 'standing straight giving a crisp salute with a determined confident smile', 'sitting up straight giving a crisp salute with one paw, determined face', 2),
  e('thanks_bow', '감사합니다', '감사합니다', '🙇', 'bowing politely at 90 degrees with hands together, grateful closed-eye smile, small sparkles', 'bowing politely with front paws together, grateful closed-eye smile', 1),
  e('sorry_bow', '죄송합니다', '죄송합니다', '🙏', 'bowing deeply in apology with hands pressed together, worried eyebrows, one sweat drop', null, 3),
  e('report', '보고서 제출', '확인 부탁드려요', '📄', 'holding out a neat stack of documents with both hands, polite hopeful smile', 'holding out a stack of papers with both paws, polite hopeful face', 11),
  e('lunch', '점심 뭐 먹지', '점심 뭐 먹지?', '🍱', 'holding chopsticks and a rice bowl, drooling slightly, dreamy hungry eyes looking up', null, 7),
  e('overtime', '야근', '야근 중…', '🌙', 'exhausted at a small desk typing on a laptop late at night, desk lamp on, a crescent moon icon above, messy hair', 'exhausted typing on a small laptop with a desk lamp, crescent moon icon above, messy fur', 6),
  e('payday', '월급날', '월급 들어왔다!', '💰', 'sparkling star-shaped eyes, hugging a bundle of money bills, coins flying around', 'sparkling star-shaped eyes, hugging a bundle of money bills, coins flying around', 8),
  e('leave_work', '퇴근!', '퇴근!', '🏃', 'running happily with a bag over the shoulder, arms raised in joy, motion lines', 'running happily on all fours with a tiny bag, ears flapping, motion lines', 0),
  e('headache', '머리 아파', '머리 아파…', '🤕', 'holding an ice pack on the head, pained squinting eyes, little swirl lines', null, 3),
];

const LOVE = [
  e('miss_you', '보고 싶어', '보고 싶어', '🥺', 'hugging a pillow tightly with teary puppy-dog eyes, small floating hearts', null, 1),
  e('kiss', '뽀뽀', '쪽♥', '😘', 'blowing a kiss with puckered lips and one eye closed, a small red heart flying from the lips', null, 2),
  e('finger_heart', '손하트', '사랑해', '🫰', 'making a Korean finger heart with thumb and index finger, cute wink, tiny hearts', 'making a heart shape with both front paws above the head, cute wink', 1),
  e('shy', '부끄부끄', '부끄…', '😳', 'covering the bright red blushing cheeks with both hands, shy sideways glance, small hearts', 'covering the blushing face with both paws, peeking shyly', 4),
  e('jealous', '질투', '흥, 질투나', '😒', 'pouting with puffed cheeks and a sideways side-eye glare, arms crossed', null, 4),
  e('hug_me', '안아줘', '안아줘', '🤗', 'arms wide open asking for a hug, pleading sparkly eyes', 'front paws stretched wide open asking for a hug, pleading sparkly eyes', 0),
  e('good_night', '잘 자', '잘 자', '🌙', 'wearing a nightcap and pajamas, yawning sleepily while waving goodnight, a crescent moon and stars', null, 9),
  e('good_morning', '굿모닝', '굿모닝!', '🌞', 'stretching arms up with a big refreshed yawn-smile, a small smiling sun icon', 'big refreshed stretch with front paws up, a small smiling sun icon', 0),
];

const DAILY = [
  e('bye', '잘 가', '안녕~', '👋', 'waving one hand goodbye with a gentle warm smile', 'waving one paw goodbye with a gentle smile', 0),
  e('flowers', '고마워요', '고마워요', '💐', 'holding out a bouquet of flowers with a warm grateful smile', null, 1),
  e('sorry', '미안해', '미안해…', '🥲', 'head lowered, fiddling fingers, guilty teary eyes', 'head lowered, ears drooping, guilty teary eyes', 5),
  e('hungry', '배고파', '배고파…', '🍽️', 'holding a fork and knife upright, drooling, stomach growling lines', null, 7),
  e('yummy', '맛있다', '냠냠', '😋', 'eating happily with stuffed round cheeks, holding a bite of food, little hearts', null, 1),
  e('dance', '신난다', '신난다~', '💃', 'dancing joyfully with arms swinging, music notes floating', 'dancing on hind legs with paws swinging, music notes floating', 8),
  e('surprised', '깜짝', '헉!', '😲', 'jumping in surprise with wide eyes and open mouth, a red exclamation mark above the head', null, 3),
  e('bored', '심심해', '심심해…', '😑', 'lying flat on the floor bored with blank half-closed eyes, chin resting on hands', 'lying flat on the floor like melted, bored blank eyes', 9),
  e('clap', '박수', '짝짝짝', '👏', 'clapping hands excitedly with a big smile, small motion lines and sparkles', 'clapping front paws excitedly with a big smile, sparkles', 8),
  e('lol', '빵 터짐', 'ㅋㅋㅋ', '🤣', 'laughing hard holding the belly with tears of joy, rolling slightly', null, 8),
  e('thinking', '생각 중', '음…', '🤔', 'hand on chin thinking hard, eyes looking up, a small thought cloud', 'paw on chin thinking hard, eyes looking up, a small thought cloud', 7),
  e('idea', '아이디어', '그거다!', '💡', 'pointing one finger up excitedly, a glowing light bulb above the head', 'one paw raised excitedly, a glowing light bulb above the head', 2),
  e('birthday', '생일 축하', '생일 축하해!', '🎂', 'holding a birthday cake with lit candles, party hat, joyful smile', null, 8),
  e('workout', '운동 중', '운동 중!', '🏋️', 'lifting a small dumbbell with determined face and a sweat drop', null, 2),
];

const PET = [
  e('box', '박스 안', '여기 내 자리', '📦', 'sitting snugly inside a cardboard box, only the head and hands peeking out, content face', 'curled up snugly inside an open cardboard box, content face', 9),
  e('back_view', '뒤태', '…', '🍑', 'seen from behind sitting down, looking back over the shoulder with a cheeky face', 'seen from behind sitting, round back and tail visible, looking back over the shoulder', 10),
  e('stretch', '기지개', '으쌰~', '🙆', 'big full-body stretch with arms high, eyes closed in satisfaction', 'big cat-style stretch with front legs forward and bottom up, eyes closed in satisfaction', 0),
  e('roll', '뒹굴뒹굴', '뒹굴~', '🛌', 'rolling on the back happily with arms and legs up', 'lying belly-up with all four paws in the air, happy face, showing paw pads', 9),
  e('treat', '간식 줘', '간식 주세요', '🍖', 'pleading with huge sparkly eyes, hands together, a small treat floating nearby', 'begging on hind legs with huge sparkly eyes, a small treat floating nearby', 1),
  e('laptop', '재택근무', '일하는 중', '💻', 'wearing round glasses, typing on a laptop with a serious face', 'wearing round glasses, typing on a laptop with a serious face', 6),
  e('knead', '꾹꾹이', '꾹꾹', '🐾', 'pressing a fluffy blanket rhythmically with both hands, blissful closed eyes', 'kneading a fluffy blanket with front paws, blissful closed eyes', 1),
  e('peek', '빼꼼', '빼꼼', '👀', 'peeking out from behind a wall edge, only half the face visible, curious eyes', 'peeking out from behind a wall edge, only half the face and one paw visible, curious eyes', 7),
  e('subway', '출근하는 집사', '출근…', '🚇', 'hanging from a subway hand strap with one hand, tired face, ID badge, briefcase', 'body stretched long hanging from a subway hand strap with one paw, tired face, ID badge, tiny briefcase', 6),
  e('im_ok', "I'm OK!", "I'm OK!", '🫠', 'face down collapsed on a laptop keyboard with one hand raised in a thumbs up, small hand-lettered "I\'m OK!"', 'face down collapsed on a laptop keyboard with one paw raised, small hand-lettered "I\'m OK!"', 6),
  e('walk', '산책 가자', '산책 가자!', '🦮', 'holding a leash excitedly, bouncing on toes, sparkly eyes', 'holding a leash in the mouth, tail wagging hard, sparkly eyes', 0),
  e('zoomies', '우다다', '우다다다!', '💨', 'running wildly with a crazy happy face, dust clouds and motion lines', 'running wildly with a crazy happy face, ears back, dust clouds and motion lines', 3),
];

// 링크클린(청소 전문 업체) 손님 응대용
const CLEAN_OUTFIT = 'wearing a neat cleaning-staff apron and pastel rubber gloves';
const LINKCLEAN = [
  e('lc_booking', '예약 감사합니다', '예약 감사합니다', '📅', `${CLEAN_OUTFIT}, bowing politely while holding a small calendar with one date circled, grateful smile`, `${CLEAN_OUTFIT}, bowing politely holding a small calendar with one date circled, grateful smile`, 1),
  e('lc_go', '출동합니다!', '출동합니다!', '🧹', `${CLEAN_OUTFIT}, carrying a bucket full of cleaning supplies in one hand and a mop in the other, confident salute-ready grin`, null, 2),
  e('lc_arrive', '현장 도착', '도착했습니다!', '🚐', `${CLEAN_OUTFIT}, waving cheerfully next to a small cleaning kit box, just arrived`, null, 0),
  e('lc_working', '열심히 청소 중', '열심히 청소 중', '🧽', `${CLEAN_OUTFIT}, scrubbing hard with a sponge, soap bubbles flying, focused face with a sweat drop`, null, 6),
  e('lc_sparkle', '반짝반짝', '반짝반짝', '✨', `${CLEAN_OUTFIT}, polishing a shiny surface with a cloth, big sparkles and star glints everywhere, proud smile`, null, 8),
  e('lc_done', '청소 완료!', '청소 완료!', '✅', `${CLEAN_OUTFIT}, giving a big thumbs up, a large green check mark and sparkles beside, satisfied smile`, null, 11),
  e('lc_mold', '곰팡이 퇴치', '곰팡이 퇴치!', '🦠', `${CLEAN_OUTFIT}, spraying a spray bottle at a tiny cute gray mold monster that is fleeing, heroic pose`, null, 2),
  e('lc_dust', '먼지 OUT', '먼지 싹!', '🌪️', `${CLEAN_OUTFIT}, using a vacuum cleaner that sucks up swirling dust clouds, determined face`, null, 3),
  e('lc_check', '꼼꼼 체크', '꼼꼼하게 확인!', '🔍', `${CLEAN_OUTFIT}, inspecting closely with a big magnifying glass, one eye enlarged, serious professional face`, null, 7),
  e('lc_movein', '입주 축하해요', '새집 입주 축하해요', '🏠', `${CLEAN_OUTFIT}, holding a small house-shaped balloon, confetti, warm congratulating smile`, null, 8),
  e('lc_thanks', '수고하셨습니다', '오늘도 수고하셨습니다', '😌', `${CLEAN_OUTFIT}, wiping sweat from the forehead with a small towel, relieved satisfied smile`, null, 1),
  e('lc_again', '또 불러주세요', '또 불러주세요!', '📞', `${CLEAN_OUTFIT}, holding a phone to the ear with a wink, a small heart floating`, null, 2),
];

// 크리머스(케이크·디저트 가게) 손님 응대용
const BAKER = 'wearing a cute baker apron and a small white baker hat';
const CREAMUS = [
  e('cr_welcome', '어서 오세요', '어서 오세요!', '🧁', `${BAKER}, welcoming with both hands open and a bright smile`, null, 0),
  e('cr_cake_ready', '케이크 나왔어요', '케이크 나왔어요!', '🎂', `${BAKER}, proudly presenting a beautiful whipped-cream strawberry cake on a cake stand, sparkles`, null, 11),
  e('cr_sweet', '오늘도 달달하게', '오늘도 달달하게♥', '🍰', `${BAKER}, holding a cupcake with cream swirl, heart-shaped eyes, small floating hearts`, null, 1),
  e('cr_order', '주문 감사합니다', '주문 감사합니다', '🎀', `${BAKER}, bowing politely while holding a cake box tied with a pink ribbon`, null, 1),
  e('cr_cream', '생크림 듬뿍', '생크림 듬뿍!', '🍦', `${BAKER}, squeezing a piping bag to decorate a cake with fluffy cream swirls, focused happy face`, null, 2),
  e('cr_fresh', '갓 구웠어요', '갓 구웠어요', '🥐', `${BAKER}, holding a tray of freshly baked pastries with warm steam rising, delighted face`, null, 8),
  e('cr_enjoy', '맛있게 드세요', '맛있게 드세요', '🍽️', `${BAKER}, offering a slice of cake on a small plate with a fork, warm smile`, null, 11),
  e('cr_birthday', '생일 축하해요', '생일 축하해요!', '🕯️', `${BAKER}, holding a birthday cake with lit candles, party popper confetti`, null, 8),
  e('cr_pickup', '픽업 완료', '픽업 완료!', '🛍️', `${BAKER}, handing over a ribbon-tied cake box with both hands, thumbs up`, null, 11),
  e('cr_new', '신메뉴 출시', 'NEW!', '🆕', `${BAKER}, presenting a new colorful dessert with sparkles and a small hand-lettered "NEW!"`, null, 8),
  e('cr_seaside', '바다 보며 디저트', '바다 보며 한입', '🌊', `${BAKER}, happily eating a dessert with small cartoon sea waves and a seagull beside`, null, 1),
  e('cr_diet', '다이어트는 내일', '다이어트는 내일부터…', '😋', `${BAKER}, guiltily eating a big slice of cake with cream on the cheek, sneaky sideways glance`, null, 4),
];

export const LIBRARY_GROUPS = [
  { id: 'basic', label: '기본', items: BASIC },
  { id: 'office', label: '직장인', items: OFFICE },
  { id: 'love', label: '연애·애정', items: LOVE },
  { id: 'daily', label: '인사·일상', items: DAILY },
  { id: 'pet', label: '반려동물 일상', items: PET },
  { id: 'linkclean', label: '링크클린', items: LINKCLEAN },
  { id: 'creamus', label: '크리머스', items: CREAMUS },
];

const ALL = Object.fromEntries(LIBRARY_GROUPS.flatMap((g) => g.items).map((x) => [x.id, x]));

const ids = (s) => s.split(' ');
export const PACKS = [
  { id: 'basic', label: '기본', emoji: '😊', ids: BASIC.map((x) => x.id) },
  { id: 'office', label: '직장인', emoji: '💼', ids: ids('commute coffee yes_sir thanks_bow sorry_bow report lunch overtime payday leave_work headache fighting') },
  { id: 'love', label: '연애·애정', emoji: '💕', ids: ids('miss_you kiss finger_heart shy jealous hug_me love good_night good_morning sad angry ok') },
  { id: 'daily', label: '인사·일상', emoji: '🌼', ids: ids('hello bye flowers sorry hungry yummy dance surprised bored clap lol thinking') },
  { id: 'pet', label: '반려동물 일상', emoji: '🐾', ids: ids('box back_view stretch roll treat laptop knead peek subway im_ok sleep cool') },
  { id: 'linkclean', label: '링크클린 손님용', emoji: '🧽', ids: LINKCLEAN.map((x) => x.id) },
  { id: 'creamus', label: '크리머스 손님용', emoji: '🍰', ids: CREAMUS.map((x) => x.id) },
];

/** 직접 입력한 상황으로 표정 만들기 (한국어 그대로 AI에 전달 — Gemini는 한국어를 이해함) */
export function customExpression(text) {
  const t = text.trim().slice(0, 40);
  const desc = `the situation/emotion described in Korean as "${t}" — show it clearly with facial expression, body pose and one simple fitting prop (no written text unless it is a very short word)`;
  return { id: `custom:${t}`, label: t, text: t, icon: '✏️', person: desc, pet: desc, demo: 0, custom: true };
}

export function packSet(packId) {
  const p = PACKS.find((x) => x.id === packId) || PACKS[0];
  return p.ids.map((id) => ALL[id]);
}

/** 저장용: id 목록 ↔ 표정 객체 */
export const serializeSet = (set) => set.map((x) => x.id);
export function deserializeSet(list) {
  if (!Array.isArray(list) || list.length !== 12) return null;
  const out = list.map((id) => (typeof id === 'string' && id.startsWith('custom:') ? customExpression(id.slice(7)) : ALL[id]));
  return out.every(Boolean) ? out : null;
}

/** 지금 구성이 어떤 팩과 같은지 (다르면 null = 직접 구성) */
export function matchPack(set) {
  const key = set.map((x) => x.id).join(',');
  return PACKS.find((p) => p.ids.join(',') === key)?.id || null;
}
