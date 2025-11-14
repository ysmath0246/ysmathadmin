// src/StudentCalendarModal.jsx
import React, { useState, useEffect, useMemo } from 'react';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { Table, Input, Group, Text, Button } from '@mantine/core';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { db } from './firebase.js';

export default function StudentCalendarModal({
  student,
  onRefreshData,
  holidayDates = [], // App에서 내려주는 휴일(YYYY-MM-DD) 배열
}) {
  const stdId = student.id;

  const holidaySet = useMemo(() => new Set(holidayDates), [holidayDates]);
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;

  // ─── A) 새/수정 루틴 & 달력 ─────────────────────
  const [editing, setEditing] = useState(false);
  const [newRoutine, setNewRoutine] = useState('');
  const [manualDates, setManualDates] = useState([]);

  // ─── B) 내 루틴 리스트 ─────────────────────────
  const [routineList, setRoutineList] = useState([]);

  // ─── C) 선택된 루틴 & 세션 ─────────────────────―
  const [selectedRoutine, setSelectedRoutine] = useState('');
  const [savedSessions, setSavedSessions] = useState([]);

  // ─── D) 출석 데이터 ─────────────────────────────
  const [attendanceData, setAttendanceData] = useState({});

  // 날짜 클릭(추가/제거)
  // 날짜 클릭(추가/제거)
const handleDayClick = (day) => {
  const yyyy = day.getFullYear();
  const mm = String(day.getMonth() + 1).padStart(2, '0');
  const dd = String(day.getDate()).padStart(2, '0');
  const d = `${yyyy}-${mm}-${dd}`;

  setManualDates((md) => {
    const exists = md.includes(d);

    if (exists) {
      // 날짜 선택 해제 : 달력 + 표에서 같이 제거
      if (editing) {
        setSavedSessions((sessions) => sessions.filter((s) => s.date !== d));
      }
      return md.filter((x) => x !== d);
    } else {
      // 새 날짜 추가 : 달력 + 표에 같이 추가
      if (editing) {
        setSavedSessions((sessions) => {
          // 이미 있으면 또 추가 X
          if (sessions.some((s) => s.date === d)) return sessions;

          const maxSession = sessions.reduce(
            (m, s) => Math.max(m, s.session || 0),
            0
          );

          return [
            ...sessions,
            {
              date: d,
              session: maxSession + 1, // 화면에서만 쓰는 임시 회차
              routineNumber: Number(newRoutine) || 0,
            },
          ];
        });
      }
      return [...md, d];
    }
  });
};

  // 루틴 저장 / 수정 저장
  const handleSave = async () => {
    const rn = newRoutine.trim();
    if (!rn || isNaN(Number(rn))) {
      alert('숫자 루틴번호를 입력하세요.');
      return;
    }
    if (manualDates.length === 0) {
      alert('날짜를 하나 이상 선택하세요.');
      return;
    }

    const sessions = {};
    manualDates
      .slice()
      .sort()
      .forEach((date, i) => {
        sessions[i + 1] = { date, routineNumber: Number(rn), session: i + 1 };
      });

    const docId = `${student.name}_${rn}`;
    await setDoc(
      doc(db, 'routines', docId),
      {
        routineNumber: Number(rn),
        students: {
          [stdId]: {
            studentId: stdId,
            name: student.name,
            sessions,
          },
        },
      },
      { merge: true }
    );

    alert(`루틴 ${docId} 저장 완료!`);
    setEditing(false);
    setNewRoutine('');
    setManualDates([]);
    await loadRoutineList();
    setSelectedRoutine(docId);
  };

  // 내 루틴 리스트 로드
  const loadRoutineList = async () => {
    if (!stdId) {
      setRoutineList([]);
      return;
    }
    const snap = await getDocs(collection(db, 'routines'));
    const list = snap.docs
      .filter((d) => Boolean(d.data().students?.[stdId]))
      .map((d) => d.id)
      .sort(
        (a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop())
      );
    setRoutineList(list);
  };

  // ✅ 학생이 바뀔 때마다 루틴 리스트 다시 로드
  useEffect(() => {
    loadRoutineList();
  }, [stdId]);

  // ✅ 학생 바뀌면 선택/편집 상태 초기화
  useEffect(() => {
    setSelectedRoutine('');
    setSavedSessions([]);
    setManualDates([]);
    setEditing(false);
    setNewRoutine('');
  }, [stdId]);

  // 선택한 루틴의 세션 로드
  useEffect(() => {
    if (!selectedRoutine) {
      setSavedSessions([]);
      return;
    }

    async function fetchSessions() {
      const snap = await getDoc(doc(db, 'routines', selectedRoutine));
      if (!snap.exists()) {
        setSavedSessions([]);
      } else {
        const obj = snap.data().students?.[stdId]?.sessions || {};
        const arr = Object.values(obj).sort((a, b) => a.session - b.session);
        setSavedSessions(arr);
      }
    }

    fetchSessions();
  }, [selectedRoutine, stdId]);

  // 세션 목록이 바뀌면 출석 데이터 로드
  useEffect(() => {
    if (savedSessions.length === 0) {
      setAttendanceData({});
      return;
    }

    async function fetchAttendance() {
      const entries = await Promise.all(
        savedSessions.map(async (s) => {
          const date = s.date;
          const snap = await getDoc(doc(db, 'attendance', date));
          const data = snap.exists() ? snap.data() : {};
          const rec = data[stdId] || data[student.name] || {};
          return [date, rec];
        })
      );
      setAttendanceData(Object.fromEntries(entries));
    }

    fetchAttendance();
  }, [savedSessions, stdId, student.name]);

  // 수정 모드 진입
  const enterEditMode = () => {
    if (!selectedRoutine) {
      alert('수정할 루틴을 선택하세요.');
      return;
    }
    setEditing(true);
    setNewRoutine(selectedRoutine.split('_').pop());
    setManualDates(savedSessions.map((s) => s.date));
  };

  // 출석 상태 변경
  const handleStatusChange = async (date, status) => {
    if (!status) return;

    const prev = attendanceData[date] || {};
    if (prev.time) {
      alert('이미 기록된 출석은 수정할 수 없습니다.');
      return;
    }

    const time =
      status === 'onTime'
        ? new Date().toISOString().slice(11, 16)
        : '';

    await setDoc(
      doc(db, 'attendance', date),
      {
        [stdId]: { name: student.name, status, time },
        [student.name]: { status, time },
      },
      { merge: true }
    );

    setAttendanceData((ad) => ({
      ...ad,
      [date]: { status, time },
    }));
    onRefreshData?.();
  };

  // 수정 모드에서 날짜 한 줄 삭제
  const handleDeleteDate = (date) => {
    if (!editing) return;
    setManualDates((md) => md.filter((d) => d !== date));
    setSavedSessions((sessions) => sessions.filter((s) => s.date !== date));
  };

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
          onChange={(e) => setNewRoutine(e.currentTarget.value)}
          style={{ width: 100 }}
        />
        <Button onClick={handleSave}>
          {editing ? '수정 저장' : '저장'}
        </Button>
      </Group>

      <DayPicker
        mode="multiple"
        selected={manualDates.map((d) => new Date(d))}
        onDayClick={handleDayClick}
        footer={`${manualDates.length}개 날짜 선택됨`}
        modifiers={{
          weekend: { dayOfWeek: [0, 6] }, // 일(0), 토(6)
          holiday: (date) => holidaySet.has(fmt(date)),
        }}
        modifiersStyles={{
          weekend: { color: 'red' },
          holiday: { color: 'red' },
        }}
      />

      {/* C: 루틴 선택 & 수정 진입 */}
      <Text weight={500} mt="lg" mb="xs">
        저장된 루틴 선택
      </Text>
      <Group mb="md" spacing="xs">
        <select
          value={selectedRoutine}
          onChange={(e) => setSelectedRoutine(e.target.value)}
          style={{ minWidth: 160, padding: 4 }}
        >
          <option value="" disabled>
            문서를 선택하세요
          </option>
          {routineList.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        <Button onClick={enterEditMode} disabled={!selectedRoutine}>
          수정
        </Button>

        {/* 루틴 삭제 버튼 */}
        <Button
          color="red"
          disabled={!selectedRoutine}
          onClick={async () => {
            if (!selectedRoutine) return;
            if (
              !window.confirm(
                `정말 '${selectedRoutine}' 루틴을 삭제하시겠습니까?`
              )
            )
              return;
            try {
              await deleteDoc(doc(db, 'routines', selectedRoutine));
              alert('루틴이 삭제되었습니다.');
              setSelectedRoutine('');
              setSavedSessions([]);
              setManualDates([]);
              setEditing(false);
              await loadRoutineList();
            } catch (e) {
              console.error(e);
              alert(
                '삭제 중 오류가 발생했습니다: ' + (e?.message || e)
              );
            }
          }}
        >
          삭제
        </Button>
      </Group>

      {/* D/E: 세션 + 출석상태 + 출석시간 + (수정 중)삭제 */}
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
            const date = s.date;
            const rec = attendanceData[date] || {};

            // 이월이면 날짜에만 취소선
            const isCarry = rec.status === 'carryover';
            const dateStyle = isCarry
              ? { textDecoration: 'line-through', color: '#999' }
              : {};

            return (
              <tr key={`${s.date}_${i}`}>
                {/* 회차: 이월이면 X, 아니면 앞의 이월 개수만큼 뺀 번호 */}
                <td>
                  {(() => {
                    const recRow = attendanceData[s.date] || {};
                    const isCarryRow = recRow.status === 'carryover';
                    const carryCountBefore = savedSessions
                      .slice(0, i)
                      .reduce((cnt, ps) => {
                        const pr = attendanceData[ps.date] || {};
                        return cnt + (pr.status === 'carryover' ? 1 : 0);
                      }, 0);
                    return isCarryRow ? 'X' : s.session - carryCountBefore;
                  })()}
                </td>

                {/* 날짜 (이월이면 가운데 줄) */}
                <td style={dateStyle}>{date}</td>

                <td>
                  {editing && !rec.time ? (
                    <select
                      value={rec.status ?? ''}
                      onChange={(e) =>
                        handleStatusChange(date, e.target.value)
                      }
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
                      {{
                        onTime: '출석',
                        absent: '결석',
                        late: '지각',
                        makeup: '보강',
                        carryover: '이월',
                        '': '미정',
                      }[rec.status]}
                    </Text>
                  )}
                </td>

                <td>{rec.time || '-'}</td>

                {editing && !rec.time && (
                  <td>
                    <Button
                      size="xs"
                      color="red"
                      onClick={() => handleDeleteDate(date)}
                    >
                      삭제
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
