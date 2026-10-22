import test from 'node:test'
import assert from 'node:assert/strict'
import { allocatePrizeKey } from '../src/utils/eventPrizeKeys.js'
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`

test('UUID 키는 BE 형식·길이를 만족하고 다음 발급을 위해 예약한다',()=>{
  const reserved=new Set()
  const key=allocatePrizeKey(reserved,()=>uuid(1))
  assert.equal(key,`PRIZE_${uuid(1)}`)
  assert.match(key,/^[A-Za-z0-9_-]{1,100}$/)
  assert.equal(key.length,42)
  assert.ok(reserved.has(key.toLowerCase()))
})
test('기존 키의 대소문자를 무시하고 충돌 시 다음 UUID를 사용한다',()=>{
  const reserved=new Set([`prize_${uuid(1).toUpperCase()}`,'GRAND'])
  const values=[uuid(1),uuid(2)]
  assert.equal(allocatePrizeKey(reserved,()=>values.shift()),`PRIZE_${uuid(2)}`)
  assert.ok(reserved.has('GRAND'))
})
test('서로 다른 발급과 삭제 후 재발급에서도 이전 키를 재사용하지 않는다',()=>{
  const reserved=new Set(),values=[uuid(1),uuid(1),uuid(2)]
  const first=allocatePrizeKey(reserved,()=>values.shift())
  const second=allocatePrizeKey(reserved,()=>values.shift())
  assert.notEqual(first,second)
  assert.equal(reserved.size,2)
})
test('반복 충돌은 제한된 횟수 후 실패하며 예약 집합을 변경하지 않는다',()=>{
  const reserved=new Set([`PRIZE_${uuid(1)}`]),before=[...reserved]
  let calls=0
  assert.throws(()=>allocatePrizeKey(reserved,()=>{calls++;return uuid(1)}),/상품을 추가하지 못했어요/)
  assert.equal(calls,16);assert.deepEqual([...reserved],before)
})
for(const invalid of ['','한글','x'.repeat(101),null,undefined])test(`잘못된 UUID ${String(invalid).slice(0,8)}는 발급하지 않는다`,()=>{
  const reserved=new Set()
  assert.throws(()=>allocatePrizeKey(reserved,()=>invalid))
  assert.equal(reserved.size,0)
})
