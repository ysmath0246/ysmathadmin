// src/StudentCalendarModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './components/ui/table';
import { Button } from './components/ui/button';
import { doc, setDoc, addDoc, deleteDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';  // ✅ onSnapshot 추가
import { db } from './firebase';
import { generateScheduleWithRollovers } from './firebase/logic';
import { getDoc } from 'firebase/firestore';

export default function StudentCalendarModal({
  student, onUpdateStudent, onRefreshData, inline,
  attendance, attendanceDate, holidays = [],
    scheduleChanges = [] // 🔥 추가
}) {
    // 📌 탭 모드를 React state 로 관리
  const [panelType, setPanelType] = useState('editStudent'); 
 // 🔥 changeData 선언을 props 사용 직후로 이동
  const [changeData, setChangeData] = useState([]);

  const [lessons, setLessons] = useState([]);
  const [currentCycle, setCurrentCycle] = useState(0);
  const cycleSize = useMemo(() => {
    const defaultDays = student.schedules?.map(s => s.day) || [];
    return defaultDays.length * 4 || 8;
  }, [student]);

  // ✅ rawAll은 변경 전 원래 요일 기준으로 생성
  // 수업변경 이력이 있다면, 가장 첫 이전 스케줄을 사용
  const originalDays = (changeData.length > 0 && changeData[0].prevSchedules)
    ? changeData[0].prevSchedules.map(s => s.day)
    : student.schedules.map(s => s.day);



// + 🔥 변경된 스케줄 적용 함수
const getActiveScheduleForDate = (dateStr) => {
  const applicable = scheduleChanges
    .filter(c => c.studentId === student.id && c.effectiveDate <= dateStr)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));

  if (applicable.length > 0) {
    return applicable[0].schedules; // 🔹 가장 최근의 변경된 스케줄
  }

  return student.schedules; // 🔹 변경이 없을 경우 원래 스케줄
};



 useEffect(() => {
   const loadChanges = async () => {
     const snapshot = await getDocs(collection(db, 'schedule_changes'));
     const filtered = snapshot.docs.map(d => d.data()).filter(c => c.studentId === student.id);
     setChangeData(filtered.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)));
   };
   loadChanges();
 }, [student.id]);

 const rebuildLessons = async (
   customAttendance = attendance,
   currentRoutineNumber,
   shouldSave = false,
   source = 'editStudent' // 'changeSchedule'일 때만 저장 실행
 ) => {



 let rawAll;
    if (source === 'changeSchedule') {
      // ▶︎ 수업변경 탭일 때만, 날짜 기준으로 before/after 합치기
      const applicableChange = changeData
        .filter(c => c.effectiveDate <= attendanceDate)
        .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0] || null;
      const changeDate = applicableChange?.effectiveDate || null;

      const prevDays = applicableChange?.prevSchedules
        ? applicableChange.prevSchedules.map(s => s.day)
        : student.schedules.map(s => s.day);
      const beforeAll = changeDate
        ? generateScheduleWithRollovers(student.startDate, prevDays, 365, holidays)
            .filter(d => d.date < changeDate)
        : [];

      const afterDays = applicableChange?.schedules
        ? applicableChange.schedules.map(s => s.day)
        : student.schedules.map(s => s.day);
      const afterAll = changeDate
        ? generateScheduleWithRollovers(changeDate, afterDays, 365, holidays)
        : generateScheduleWithRollovers(student.startDate, afterDays, 365, holidays);

      rawAll = [...beforeAll, ...afterAll];
    } else {
      // ◀︎ 그 외: 무조건 처음 등록된 루틴(원본 스케줄)만
      const days = student.schedules.map(s => s.day);
      rawAll = generateScheduleWithRollovers(student.startDate, days, 365, holidays);
    }

const raw = rawAll.filter((r) => {
  const rDate = r.date;
  const rDay = new Date(rDate).getDay();
  const dayName = ['일', '월', '화', '수', '목', '금', '토'][rDay];

  // 🔹 수업변경탭인 경우만 날짜 이후 변경 스케줄 적용
  if (source === 'changeSchedule') {
    const applicable = changeData
      .filter(c => c.effectiveDate <= rDate)
      .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    const schedule = applicable.length > 0 ? applicable[0].schedules : student.schedules;
    return schedule.some(s => s.day === dayName);
  }

  // 🔹 수정탭은 무조건 원래 스케줄
  return student.schedules.some(s => s.day === dayName);
});




  const filtered = raw.filter(l => !holidays.includes(l.date));
  const baseLessons = filtered.map((l, idx) => {
    const att = customAttendance?.[l.date]?.[student.name];
    let status = att?.status;
    let time = att?.time || '';
    if (!status) status = l.date < attendanceDate ? '결석' : '미정';
    return { date: l.date, status, time, originalIndex: idx };
  });

  const snapshot = await getDocs(collection(db, 'makeups'));
  const allMakeups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(m => m.name === student.name);
  const clinics = allMakeups.filter(m => m.type === '보강');

  for (const m of clinics) {
    const origin = baseLessons.find(l => l.date === m.sourceDate);
    if (origin) {
      if (m.status === '보강가능') {
        origin.status = '보강가능';
        origin.makeupDate = m.date;
      } else if (m.status === '보강완료') {
        origin.makeupDate = m.date;
        origin.status = '보강완료';
      }
    }
  }

  let merged = [...baseLessons].sort((a, b) => a.date.localeCompare(b.date));
  const existingKeys = new Set(merged.map(l => l.date + '-' + l.originalIndex));
  let lastDate = merged.length > 0 ? merged.at(-1).date : student.startDate;

  while (true) {
    const normalCount = merged.filter(m => m.status !== '이월').length;
    if (normalCount >= cycleSize * 10) break;
    const next = generateScheduleWithRollovers(lastDate, originalDays, 1, holidays).find(d => {
      const key = d.date + '-' + d.originalIndex;
      return !existingKeys.has(key);
    });
    if (!next) break;
    lastDate = next.date;
    existingKeys.add(next.date + '-' + next.originalIndex);
    merged.push({ date: next.date, status: '미정', time: '', originalIndex: next.originalIndex });
  }

  const sorted = merged.sort((a, b) => a.date.localeCompare(b.date));
  setLessons(sorted);

  if (shouldSave && source === 'changeSchedule') {
    const reindexedForSave = [];
    let routineNumber = currentRoutineNumber || student.startRoutine || 1;
    let count = 1;
    let nonSkipCount = 0;

    for (let i = 0; i < sorted.length; i++) {
      const l = sorted[i];
      if (l.status === '이월') {
        reindexedForSave.push({ ...l, session: 'X', routineNumber });
      } else {
        reindexedForSave.push({ ...l, session: count, routineNumber });
        count++;
        nonSkipCount++;
        if (nonSkipCount === cycleSize) {
          routineNumber++;
          count = 1;
          nonSkipCount = 0;
        }
      }
    }

const routineDoc = await getDoc(doc(db, 'routines', student.id));
 const existingLessons = routineDoc.exists() ? routineDoc.data().lessons : [];
   // 📝 저장할 때도, 오늘(today) 기준으로 마지막 변경만 덮어쓰기
  const applicableChangeToSave = scheduleChanges
    .filter(c => c.studentId === student.id && c.effectiveDate <= today)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0] || null;
  const changeStartDate = applicableChangeToSave?.effectiveDate || null;


 // 🔥 변경된 날짜 이후만 덮어쓰기, 이전은 유지
 const mergedLessons = changeStartDate
   ? [
       ...existingLessons.filter(l => l.date < changeStartDate),
       ...reindexedForSave.filter(l => l.date >= changeStartDate)
     ]
   : reindexedForSave;

 await setDoc(doc(db, 'routines', student.id), {
   studentId: student.id,
   name: student.name,
   lessons: mergedLessons,
   updatedAt: new Date().toISOString()
 });

  }
};
useEffect(() => {
  const routineNum = (student?.startRoutine || 1) + currentCycle;
  // 🛠️ BODY 속성 대신 React state 사용
  rebuildLessons(attendance, routineNum, false, panelType);
}, [student, attendanceDate, holidays, currentCycle]);

  // ✅ 출석 상태 변경 핸들러
  const handleSelectChange = async (date, newStatus) => {
    const time = ['출석', '지각'].includes(newStatus) ? new Date().toISOString().slice(11, 16) : '';
    await setDoc(doc(db, 'attendance', date), { [student.name]: { status: newStatus, time } }, { merge: true });

    if (newStatus === '이월') {
// + 변경된 스케줄 조회
const schedules = await getActiveScheduleForDate(student.id, date);
const days = schedules.map(s => s.day);

const nextDates = generateScheduleWithRollovers(date, days, 10, holidays);
      const usedDates = lessons.map(l => l.date);
      const next = nextDates.find(d => !usedDates.includes(d.date));
      if (next) {
        await addDoc(collection(db, 'makeups'), {
          name: student.name,
          type: '이월',
          sourceDate: date,
          date: next.date,
          completed: false,
        });
      }
    } else if (newStatus === '보강') {
  const snapshot = await getDocs(collection(db, 'makeups'));
  const existing = snapshot.docs.find(docSnap => {
    const d = docSnap.data();
    return d.name === student.name && d.sourceDate === date;
  });

  if (existing) {
   await updateDoc(doc(db, 'makeups', existing.id), {
     status: '보강가능',
     date: date
   });
  } else {
    await addDoc(collection(db, 'makeups'), {
      name: student.name,
      type: '보강',
      sourceDate: date,
      date: date,
      status: '보강가능',
    });
  }
}
 else if (newStatus === '미정') {
      const snapshot = await getDocs(collection(db, 'makeups'));
      for (const docSnap of snapshot.docs) {
        const d = docSnap.data();
        if ((d.date === date || d.sourceDate === date) && d.name === student.name) {
          await deleteDoc(doc(db, 'makeups', docSnap.id));
        }
      }
      await setDoc(doc(db, 'attendance', date), {
        [student.name]: { status: '미정', time: '' }
      }, { merge: true });
    }

    const newAttendance = { ...attendance };
    if (!newAttendance[date]) newAttendance[date] = {};
    newAttendance[date][student.name] = { status: newStatus, time };
    const routineNum = (student?.startRoutine || 1) + currentCycle;
    // 🛠️ 여기에도 panelType을 source로 넘겨줘야 원본 스케줄/변경 스케줄 로직이 구분됩니다
    await rebuildLessons(newAttendance, routineNum, false, panelType);

    if (onRefreshData) {
      await onRefreshData();
    }
  };


  // ✅ 화면 출력용 reindexed (lessons → 루틴 회차 붙이기)
  const displayed = [];
  let normalCount = 0;
  let idx = 0;
  let cycleStart = 0;

  for (let i = 0; i < lessons.length; i++) {
    if (lessons[i].status !== '이월') {
      if (normalCount === currentCycle * cycleSize) cycleStart = i;
      normalCount++;
    }
  }

  normalCount = 0;
  idx = cycleStart;
  while (idx < lessons.length && normalCount < cycleSize) {
    const l = lessons[idx];
      displayed.push(l);  // ✅ 보강완료도 표시
  if (l.status !== '이월' ) normalCount++;  // ✅ count 제외
    idx++;
  }

  const reindexed = [];
  let count = 1;
  for (let l of displayed) {
    if (l.status === '이월') {
      reindexed.push({ ...l, session: 'X' });
    } else {
      reindexed.push({ ...l, session: count++ });
    }
  }

  const handleSave = () => {
    onUpdateStudent({ ...student, lessons });
    alert('수업 일정이 저장되었습니다.');
  };
useEffect(() => {
   // ➕ changeSchedule 패널일 때만 true
   const shouldSave = panelType === 'changeSchedule';
   const unsubAttendance = onSnapshot(collection(db, 'attendance'), () => {
     const routineNum = (student?.startRoutine || 1) + currentCycle;
     rebuildLessons(attendance, routineNum, shouldSave, panelType);
   });
   const unsubMakeups = onSnapshot(collection(db, 'makeups'), () => {
     const routineNum = (student?.startRoutine || 1) + currentCycle;
     rebuildLessons(attendance, routineNum, shouldSave, panelType);
   });

   return () => {
     unsubAttendance();
     unsubMakeups();
   };
 }, [student.id, attendance, currentCycle, panelType]);

 // ✅ 외부에서 rebuildLessons 접근 가능하게 expose
 useEffect(() => {
   if (typeof window !== 'undefined') {
     const elem = document.getElementById('student-calendar');
     if (elem) elem.rebuildLessons = rebuildLessons;
   }
 }, []);


  return (
<div id="student-calendar" className={inline ? 'p-4 bg-white rounded shadow max-h-[80vh] overflow-auto' : 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'}>
      <div className={inline ? '' : 'bg-white rounded p-4 w-11/12 md:w-2/3 lg:w-1/2 max-h-[90vh] overflow-auto'}>
        <h2 className="text-xl font-semibold mb-2">{student.name}님의 수업 일정</h2>
        <div className="flex justify-between items-center mb-2">
          <Button disabled={currentCycle === 0} onClick={() => setCurrentCycle(c => c - 1)}>◀ 이전</Button>
          <span>루틴 {(student?.startRoutine || 1) + currentCycle}</span>
          <Button disabled={lessons.filter(l => l.status !== '이월').length <= (currentCycle + 1) * cycleSize} onClick={() => setCurrentCycle(c => c + 1)}>다음 ▶</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>회차</TableHead>
              <TableHead>날짜</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>시간</TableHead>
              <TableHead>변경</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reindexed.map((l, i) => (
              <TableRow key={i}>
                <TableCell>{l.session}</TableCell>
              <TableCell>
  {l.makeupDate ? (
    <div>
      <s>{l.date}</s> ➔ <span>{l.makeupDate}</span>
    </div>
  ) : (
    <>
      <div>{l.date}</div>

      {(() => {
     // 수업 변경된 첫 날짜에만 표시
const change = scheduleChanges.find(sc => 
  sc.studentId === student.id && sc.effectiveDate === l.date
);


        if (!change) return null;

        return (
          <div className="text-xs text-blue-600 mt-1 whitespace-pre-wrap">
            🛠️ 수업시간 변경됨:
            {"\n"}
            {change.prevSchedules?.map(s => `${s.day} ${s.time}`).join(', ')} → {change.schedules?.map(s => `${s.day} ${s.time}`).join(', ')}
          </div>
        );
      })()}
    </>
  )}
</TableCell>

                <TableCell>{l.status}</TableCell>
                <TableCell>{l.time || '-'}</TableCell>
                <TableCell>
                  <select value={l.status} onChange={e => handleSelectChange(l.date, e.target.value)}>
                    {['출석', '지각', '결석', '이월', '보강', '미정'].map(opt => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end mt-4">
          <Button size="sm" className="px-2 py-1 text-xs" onClick={handleSave}>저장</Button>
        </div>
      </div>
    </div>
  );
}
