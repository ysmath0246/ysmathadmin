// src/StudentRow.jsx
import React from 'react';
import { TableRow, TableCell } from './components/ui/table';
import { Button } from './components/ui/button';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

function StudentRow({ student, onSelect, onEdit, onDelete }) {
  // PIN 초기화 핸들러: 생년월일 뒤 4자리로 복원
  const handleReset = async () => {
    const confirmMsg = `${student.name}님의 PIN을 생년월일 뒤 4자리(${student.birth.slice(-4)})로 초기화하시겠습니까?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      await updateDoc(doc(db, 'students', student.id), {
        pin: student.birth.slice(-4)
      });
      alert(`${student.name}님의 PIN이 초기화되었습니다.`);
    } catch (e) {
      console.error(e);
      alert('PIN 초기화 중 오류가 발생했습니다.');
    }
  };

  return (
    <TableRow>
      {/* 이름 클릭 시 상세 달력 모달 열기 */}
      <TableCell className="whitespace-nowrap">
        <span
          className="cursor-pointer text-blue-500 hover:underline"
          onClick={() => onSelect(student)}
        >
          {student.name}
        </span>
      </TableCell>
      {/* 생년월일 */}
      <TableCell>{student.birth || '-'}</TableCell>
      {/* 학부모 연락처 */}
      <TableCell>{student.parentPhone || '-'}</TableCell>
      {/* 수업 스케줄 요일·시간 */}
      <TableCell>
        {student.schedules?.map((s, i) => (
          <div key={i}>{s.day} {s.time}</div>
        )) || '-'}
      </TableCell>
      {/* PIN 초기화 버튼 */}
      <TableCell>
        <Button size="sm" variant="destructive" onClick={handleReset}>
          초기화
        </Button>
      </TableCell>
      {/* 수정/삭제 버튼 */}
      <TableCell>
        <Button size="sm" onClick={() => onEdit(student)} className="mr-2">
          수정
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(student.id)}>
          삭제
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default React.memo(StudentRow);