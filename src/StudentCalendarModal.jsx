// src/StudentCalendarModal.jsx
import React, { useState, useEffect, useMemo } from 'react'


import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc
} from 'firebase/firestore'
import {
  Table,
  Input,
  Group,
  Text,
  Button,
  Select as MantineSelect
} from '@mantine/core'
//import { ArrowUp, ArrowDown } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { db } from './firebase.js'

export default function StudentCalendarModal({
  student,
  onRefreshData,
  holidayDates = []      // ← App에서 내려줄 휴일(YYYY-MM-DD) 배열
}) {
  
  const stdId = student.id
const holidaySet = useMemo(() => new Set(holidayDates), [holidayDates])
 const fmt = (d) =>
   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
     d.getDate()
   ).padStart(2, '0')}`


  // ─── A) 새/수정 루틴 & 달력 ─────────────────────
  const [editing, setEditing] = useState(false)
  const [newRoutine, setNewRoutine] = useState('')
  const [manualDates, setManualDates] = useState([])

  const handleDayClick = day => {
    const yyyy = day.getFullYear()
   const mm   = String(day.getMonth() + 1).padStart(2, '0')
   const dd   = String(day.getDate()     ).padStart(2, '0')
   const d    = `${yyyy}-${mm}-${dd}`
    setManualDates(md =>
      md.includes(d) ? md.filter(x=>x!==d) : [...md, d]
    )
  }

  const handleSave = async () => {
    const rn = newRoutine.trim()
    if (!rn || isNaN(Number(rn))) {
      alert('숫자 루틴번호를 입력하세요.')
      return
    }
    if (manualDates.length === 0) {
      alert('날짜를 하나 이상 선택하세요.')
      return
    }
    const sessions = {}
    manualDates.sort().forEach((date,i) => {
      sessions[i+1] = { date, routineNumber: Number(rn), session: i+1 }
    })
    const docId = `${student.name}_${rn}`
    await setDoc(
      doc(db,'routines',docId),
      {
        routineNumber: Number(rn),
        students: {
          [stdId]: {
            studentId: stdId,
            name: student.name,
            sessions
          }
        }
      },
      { merge: true }
    )
    alert(`루틴 ${docId} 저장 완료!`)
    setEditing(false)
    setNewRoutine('')
    setManualDates([])
    await loadRoutineList()
    setSelectedRoutine(docId)
  }

  // ─── B) 내 루틴 리스트 로드 ─────────────────────
  const [routineList, setRoutineList] = useState([])
 const loadRoutineList = async () => {
  console.log("선택된 학생 id:", stdId)
  const snap = await getDocs(collection(db, 'routines'))
  const list = snap.docs
    .filter(d => Boolean(d.data().students?.[stdId]))
    .map(d => d.id)
    .sort((a, b) =>
      Number(a.split('_').pop()) - Number(b.split('_').pop())
    )
  setRoutineList(list)
}


  useEffect(() => {
    loadRoutineList()
  }, [])

  // ─── C) 루틴 선택 → 세션 로드 ────────────────────
  const [selectedRoutine, setSelectedRoutine] = useState('')
  const [savedSessions, setSavedSessions] = useState([])
  useEffect(() => {
    if (!selectedRoutine) {
      setSavedSessions([])
      return
    }
    async function fetchSessions() {
      const snap = await getDoc(doc(db,'routines',selectedRoutine))
      if (!snap.exists()) {
        setSavedSessions([])
      } else {
       const obj = snap.data().students?.[stdId]?.sessions || {}
const arr = Object.values(obj).sort((a,b) => a.session - b.session)
setSavedSessions(arr)

      }
    }
    fetchSessions()
  }, [selectedRoutine, stdId])

  const enterEditMode = () => {
    if (!selectedRoutine) {
      alert('수정할 루틴을 선택하세요.')
      return
    }
    setEditing(true)
    setNewRoutine(selectedRoutine.split('_').pop())
    setManualDates(savedSessions)
  }

  // ─── D) 출석 데이터 로드 ─────────────────────────
  const [attendanceData, setAttendanceData] = useState({})
  useEffect(() => {
  if (!selectedRoutine) {
    setSavedSessions([])
    return
  }
  async function fetchSessions() {
    const snap = await getDoc(doc(db, 'routines', selectedRoutine))
    if (!snap.exists()) {
      setSavedSessions([])
    } else {
      const obj = snap.data().students?.[stdId]?.sessions || {}
      const arr = Object.values(obj).sort((a, b) => a.session - b.session)
      setSavedSessions(arr)
    }
  }
  fetchSessions()
}, [selectedRoutine, stdId])

useEffect(() => {
  if (savedSessions.length === 0) {
    setAttendanceData({});
    return;
  }
  async function fetchAttendance() {
    const entries = await Promise.all(
      savedSessions.map(async s => {
        const date = s.date;
        const snap = await getDoc(doc(db, 'attendance', date));
        const data = snap.exists() ? snap.data() : {};

       const rec = data[stdId] || data[student.name] || {};


          console.log(`→ ${date}의 rec:`, rec);

        return [date, rec];
      })
    );
    setAttendanceData(Object.fromEntries(entries));
  }
  fetchAttendance();
}, [savedSessions, stdId]);




  // ─── E) 출석 상태 변경 핸들러 ───────────────────
  const handleStatusChange = async (date, status) => {
    // '미정' 은 처리하지 않음
   if (!status) return


    const prev = attendanceData[date] || {}
    if (prev.time) {
      alert('이미 기록된 출석은 수정할 수 없습니다.')
      return
    }
    const time = status === 'onTime'
      ? new Date().toISOString().slice(11,16)
      : ''
    await setDoc(
   doc(db,'attendance',date),
   {
     // 둘 중 하나만 남기셔도 되고, 둘 다 병기해도 무방합니다.
     [stdId]:  { name: student.name, status, time },
     [student.name]: { status, time }
   },
   { merge: true }
 );


    setAttendanceData(ad => ({
      ...ad,
      [date]: { status, time }
    }))
    onRefreshData?.()
  }

  // ─── F) 수정 모드에서 날짜 삭제 ───────────────────
  const handleDeleteDate = date => {
    if (!editing) return
    setManualDates(md => md.filter(d=>d!==date))
  }

  return (
    <div>
      {/* A: 새/수정 루틴 & 달력 */}
      <Text weight={500} mb="xs">
        {editing ? '루틴 수정 중' : '새 루틴번호 입력'} & 날짜 선택
      </Text>
      <Group mb="sm" spacing="xs">
        <Input
          placeholder="루틴번호"
          value={newRoutine}
          onChange={e=>setNewRoutine(e.currentTarget.value)}
          style={{ width: 100 }}
        />
        <Button onClick={handleSave}>
          {editing ? '수정 저장' : '저장'}
        </Button>
      </Group>
      <DayPicker
        mode="multiple"
        selected={manualDates.map(d=>new Date(d))}
        onDayClick={handleDayClick}
        footer={`${manualDates.length}개 날짜 선택됨`}
      modifiers={{
     weekend: { dayOfWeek: [0, 6] },                 // 일(0), 토(6)
     holiday: (date) => holidaySet.has(fmt(date)),   // 휴일관리 + 공휴일
   }}
   modifiersStyles={{
     weekend: { color: 'red' },
     holiday: { color: 'red' },
   }}
     />

      {/* C: 루틴 선택 & 수정 진입 */}
      <Text weight={500} mt="lg" mb="xs">저장된 루틴 선택</Text>
      <Group mb="md" spacing="xs">
        <select
          value={selectedRoutine}
          onChange={e=>setSelectedRoutine(e.target.value)}
          style={{ minWidth: 160, padding: 4 }}
        >
          <option value="" disabled>문서를 선택하세요</option>
          {routineList.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
        <Button
          onClick={enterEditMode}
          disabled={!selectedRoutine}
        >수정</Button>
      </Group>

      {/* D/E: 세션 + 출석상태(Select) + 출석시간 + (수정 중)삭제 */}
      <Table striped highlightOnHover>
        <thead>
          <tr>
            <th>회차</th>
            <th>날짜</th>
            <th>출석상태</th>
            <th>출석시간</th>
            {editing && <th>삭제</th>}
          </tr>
        </thead>
        <tbody>
  {savedSessions.map((s, i) => {
    const date = s.date
    const rec = attendanceData[date] || {}
    return (
      <tr key={`${s.date}_${i}`}>
              {/* 이월일 때만 'X', 아니면 앞에 이월된 횟수만큼 뺀 숫자 */}
              {(() => {
                const rec = attendanceData[s.date] || {}
                const isCarry = rec.status === 'carryover'
                const carryCountBefore = savedSessions
                  .slice(0, i)
                  .reduce((cnt, ps) => {
                    const pr = attendanceData[ps.date] || {}
                    return cnt + (pr.status === 'carryover' ? 1 : 0)
                  }, 0)
                return isCarry ? 'X' : s.session - carryCountBefore
              })()}
        <td>{date}</td>
        <td>
          {editing && !rec.time ? (
            <select
              value={rec.status ?? ''}
             onChange={e => handleStatusChange(date, e.target.value)}
              style={{ width: '100%', padding: '4px' }}
            >
              <option value="">미정</option>
              <option value="onTime">출석</option>
              <option value="absent">결석</option>
              <option value="late">지각</option>
              <option value="makeup">보강</option>
   <option value="carryover">이월</option>
            </select>
          ) : (
            <Text>
              {{ onTime: '출석', absent: '결석', late: '지각', makeup: '보강',
  carryover: '이월', '': '미정' }[rec.status]}
            </Text>
          )}
        </td>
        <td>{rec.time || '-'}</td>
        {/* 삭제 버튼은 “미정(rec.time이 없는)” 행에만 */}
       {editing && !rec.time && (
         <td>
           <Button
             size="xs"
             color="red"
             onClick={() => handleDeleteDate(date)}
           >삭제</Button>
         </td>
       )}
      </tr>
    )
  })}
</tbody>

      </Table>
    </div>
  )
}
