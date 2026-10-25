// 보는 사람의 시간대가 일정 시간대(서울)와 달라도 종일 일정은 등록한 날짜에 그대로 놓인다.
process.env.TZ = 'America/Los_Angeles'

const assert = (await import('node:assert/strict')).default
const test = (await import('node:test')).default
const { coveredDayKeys, findNextSchedules, formatScheduleRange, formatScheduleStart, sortBySpanStart } = await import('../src/utils/calendarGrid.js')

const seoul = (startAt, endAt, allDay = true) => ({ scheduleId: 1, startAt, endAt, allDay, timeZone: 'Asia/Seoul' })
const october = [new Date(2026, 9, 1), new Date(2026, 10, 1)]

test('서울 하루 종일 일정은 로스앤젤레스에서 봐도 그 날짜 하루에만 놓인다', () => {
  const schedule = seoul('2026-10-09T15:00:00Z', '2026-10-10T15:00:00Z')
  assert.deepEqual(coveredDayKeys(schedule, ...october), ['2026-10-10'])
  assert.equal(formatScheduleRange(schedule), '26.10.10. 종일')
  assert.equal(formatScheduleStart(schedule), '26.10.10. 종일')
  // 같은 시각의 시간 일정은 보는 사람의 시간대로 이틀에 걸친다.
  assert.deepEqual(coveredDayKeys(seoul('2026-10-09T15:00:00Z', '2026-10-10T15:00:00Z', false), ...october), ['2026-10-9', '2026-10-10'])
})

test('여러 날 종일 일정은 첫날부터 마지막 날까지 놓이고, 보이는 달 밖은 잘린다', () => {
  const schedule = seoul('2026-10-09T15:00:00Z', '2026-10-12T15:00:00Z')
  assert.deepEqual(coveredDayKeys(schedule, ...october), ['2026-10-10', '2026-10-11', '2026-10-12'])
  assert.equal(formatScheduleRange(schedule), '26.10.10. – 26.10.12. 종일')
  assert.deepEqual(coveredDayKeys(seoul('2026-10-30T15:00:00Z', '2026-11-01T15:00:00Z'), ...october), ['2026-10-31'])
})

test('다음 일정은 종일 일정을 그 날짜 0시에 시작하는 것으로 본다', () => {
  const allDay = seoul('2026-10-09T15:00:00Z', '2026-10-10T15:00:00Z')
  const timed = { ...seoul('2026-10-09T15:00:00Z', '2026-10-09T16:00:00Z', false), scheduleId: 2 }
  const endOfOctober9 = new Date(2026, 9, 9, 23, 59, 59, 999)
  assert.deepEqual(findNextSchedules([timed, allDay], endOfOctober9).map((schedule) => schedule.scheduleId), [1])
})

test('정렬은 달력에 놓이는 시작 순서를 따른다(서울 10/11 종일은 로스앤젤레스 10/10 20:00 일정보다 뒤)', () => {
  const allDay = seoul('2026-10-10T15:00:00Z', '2026-10-11T15:00:00Z')
  const timed = { scheduleId: 2, startAt: '2026-10-11T03:00:00Z', endAt: '2026-10-11T04:00:00Z', allDay: false, timeZone: 'America/Los_Angeles' }
  assert.deepEqual(sortBySpanStart([allDay, timed]).map((schedule) => schedule.scheduleId), [2, 1])
})
