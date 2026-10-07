// 실험용 더미 데이터 — 서비스 계약이 아니다.
// 출처: Cking-LLM-Benchmark data/creator-subtopics.json (status: experimental_not_service_contract).
// BE 분류체계(v0.2)에는 세부 태그가 없어서 선택해도 저장되지 않는다(이슈 #83). 계약이 확정되면 이 파일은 삭제하고 BE 응답으로 바꾼다.

/** 상위 분야 하나에서 고를 수 있는 세부 태그 수(임의 가정, 팀 결정 전). */
export const SUBTAG_MAX_PER_PARENT = 3

/** 상위 interestCode → 세부 태그 목록 */
export const DUMMY_SUBTAGS = {
  FITNESS: [
    { code: 'FITNESS_WEIGHTS', name: '웨이트' },
    { code: 'FITNESS_HOME_WORKOUT', name: '홈트' },
    { code: 'FITNESS_YOGA', name: '요가' },
    { code: 'FITNESS_PILATES', name: '필라테스' },
    { code: 'FITNESS_RUNNING', name: '러닝' },
    { code: 'FITNESS_HIKING', name: '등산' },
    { code: 'FITNESS_WEIGHT_MANAGEMENT', name: '체중 관리' },
  ],
  FOOD: [
    { code: 'FOOD_HOME_COOKING', name: '집밥·요리' },
    { code: 'FOOD_BAKING', name: '베이킹' },
    { code: 'FOOD_DESSERT', name: '디저트' },
    { code: 'FOOD_EATING', name: '먹방' },
    { code: 'FOOD_RESTAURANTS', name: '맛집' },
  ],
  GAME: [
    { code: 'GAME_ACTION', name: '액션·슈팅' },
    { code: 'GAME_RPG', name: 'RPG' },
    { code: 'GAME_STRATEGY', name: '전략·MOBA' },
    { code: 'GAME_SIMULATION', name: '생활·경영 시뮬레이션' },
    { code: 'GAME_SPORTS_RACING', name: '스포츠·레이싱 게임' },
    { code: 'GAME_PUZZLE_CASUAL', name: '퍼즐·캐주얼' },
  ],
  BEAUTY: [
    { code: 'BEAUTY_MAKEUP', name: '메이크업' },
    { code: 'BEAUTY_SKINCARE', name: '스킨케어' },
    { code: 'BEAUTY_HAIR', name: '헤어' },
    { code: 'BEAUTY_NAILS', name: '네일' },
  ],
  FASHION: [
    { code: 'FASHION_CLOTHING', name: '의류·코디' },
    { code: 'FASHION_SHOES', name: '신발' },
    { code: 'FASHION_BAGS', name: '가방' },
    { code: 'FASHION_ACCESSORIES', name: '액세서리' },
  ],
  TRAVEL: [
    { code: 'TRAVEL_DOMESTIC', name: '국내 여행' },
    { code: 'TRAVEL_INTERNATIONAL', name: '해외 여행' },
    { code: 'TRAVEL_CAMPING', name: '캠핑' },
    { code: 'TRAVEL_CAR_CAMPING', name: '차박' },
  ],
  MUSIC: [
    { code: 'MUSIC_VOCAL', name: '보컬' },
    { code: 'MUSIC_COMPOSITION', name: '작곡·음악 제작' },
    { code: 'MUSIC_INSTRUMENT', name: '악기' },
    { code: 'MUSIC_DANCE', name: '댄스' },
  ],
  PET: [
    { code: 'PET_DOG', name: '강아지' },
    { code: 'PET_CAT', name: '고양이' },
    { code: 'PET_OTHER_ANIMALS', name: '기타 반려동물' },
    { code: 'PET_TRAINING', name: '반려동물 훈련' },
    { code: 'PET_ADOPTION', name: '입양·구조' },
  ],
  TECH: [
    { code: 'TECH_MOBILE', name: '모바일' },
    { code: 'TECH_PC', name: 'PC' },
    { code: 'TECH_DEVICES', name: '전자기기' },
    { code: 'TECH_PROGRAMMING', name: '프로그래밍' },
    { code: 'TECH_AI', name: 'AI 기술·활용' },
  ],
  KNOWLEDGE: [
    { code: 'KNOWLEDGE_STUDY', name: '공부법' },
    { code: 'KNOWLEDGE_BOOKS', name: '독서' },
    { code: 'KNOWLEDGE_HISTORY', name: '역사' },
    { code: 'KNOWLEDGE_SCIENCE', name: '과학·자연' },
    { code: 'KNOWLEDGE_ECONOMICS', name: '경제 지식' },
    { code: 'KNOWLEDGE_FINANCE', name: '재테크' },
  ],
  ENTERTAIN: [
    { code: 'ENTERTAIN_FILM', name: '영화' },
    { code: 'ENTERTAIN_DRAMA', name: '드라마' },
    { code: 'ENTERTAIN_VARIETY', name: '예능' },
    { code: 'ENTERTAIN_ANIMATION', name: '애니메이션' },
    { code: 'ENTERTAIN_WEBTOON', name: '웹툰' },
    { code: 'ENTERTAIN_FANDOM', name: '팬 콘텐츠' },
  ],
  HUMOR: [
    { code: 'HUMOR_COMEDY', name: '코미디' },
    { code: 'HUMOR_MEMES', name: '밈·웃긴 소재' },
    { code: 'HUMOR_HEARTWARMING', name: '감동 소재' },
  ],
  SPORTS: [
    { code: 'SPORTS_BASEBALL', name: '야구' },
    { code: 'SPORTS_FOOTBALL', name: '축구' },
    { code: 'SPORTS_GOLF', name: '골프' },
    { code: 'SPORTS_COMBAT', name: '격투기' },
    { code: 'SPORTS_BASKETBALL', name: '농구' },
    { code: 'SPORTS_OTHER_SPORTS', name: '기타 스포츠' },
  ],
  NEWS: [
    { code: 'NEWS_POLITICS', name: '정치' },
    { code: 'NEWS_SOCIETY', name: '사회' },
    { code: 'NEWS_INTERNATIONAL', name: '국제' },
    { code: 'NEWS_ECONOMIC_NEWS', name: '경제 뉴스' },
    { code: 'NEWS_CELEBRITY_NEWS', name: '연예 뉴스' },
  ],
  LIFE: [
    { code: 'LIFE_PERSONAL', name: '개인 일상' },
    { code: 'LIFE_PARENTING', name: '육아' },
    { code: 'LIFE_FAMILY', name: '가족' },
    { code: 'LIFE_COUPLE', name: '커플' },
    { code: 'LIFE_STORIES', name: '생활 사연' },
  ],
  HOBBY: [
    { code: 'HOBBY_FISHING', name: '낚시' },
    { code: 'HOBBY_CRAFTS', name: '공예·제작' },
    { code: 'HOBBY_DRAWING', name: '그림' },
    { code: 'HOBBY_COLLECTING', name: '수집' },
    { code: 'HOBBY_GARDENING', name: '원예' },
  ],
  LIFETIP: [
    { code: 'LIFETIP_HOUSEHOLD', name: '생활 관리' },
    { code: 'LIFETIP_KITCHEN_GOODS', name: '주방용품' },
    { code: 'LIFETIP_HOME_GOODS', name: '생활용품' },
    { code: 'LIFETIP_INTERIOR', name: '인테리어' },
    { code: 'LIFETIP_SHOPPING', name: '쇼핑 정보' },
  ],
}
