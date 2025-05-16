// src/BulkStudentUploadExcel.jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { generateScheduleWithRollovers } from './firebase/logic';

// 엑셀 파일의 데이터를 받아서 Firebase에 대량 등록하는 함수
async function bulkRegisterStudents(studentsArray) {
  const promises = studentsArray.map(async (row) => {
    // row 객체 예시: 
    // { name: "홍길동", birth: "2000-01-01", startDate: "2025-04-13", parentPhone: "010-0000-0000", schedules: "월,15:00;화,15:30" }
    const schedules = row.schedules
      ? row.schedules.split(';').map(item => {
          const [day, time] = item.split(',');
          return { day: day.trim(), time: time.trim() };
        })
      : [{ day: '', time: '' }];

    const newStudent = {
      name: row.name,
      birth: row.birth,
      startDate: row.startDate,
      parentPhone: row.parentPhone,
      schedules: schedules,
    };

    // 수업 일정 생성: schedules 길이에 따라 12회 혹은 8회 등 결정
    const generatedLessons = generateScheduleWithRollovers(
      newStudent.startDate,
      newStudent.schedules.map(s => s.day),
      newStudent.schedules.length === 3 ? 12 : 8
    );

    const studentData = { ...newStudent, lessons: generatedLessons };

    // Firebase "students" 컬렉션에 등록
    const docRef = await addDoc(collection(db, 'students'), studentData);
    return { id: docRef.id, ...studentData };
  });

  return Promise.all(promises);
}

export default function BulkStudentUploadExcel({ onBulkUpload }) {
  const [fileData, setFileData] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const binaryStr = evt.target.result;
      const wb = XLSX.read(binaryStr, { type: 'binary' });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      // 첫 번째 행(header)와 그 이후의 행들을 배열로 변환
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const headers = data[0];
      const rows = data.slice(1);
      const studentsArray = rows.map((row) => {
        const obj = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx];
        });
        return obj;
      });
      setFileData(studentsArray);
    };
    reader.readAsBinaryString(file);
  };

  const handleBulkUpload = async () => {
    if (!fileData) return;
    try {
      setUploadStatus('업로드 중...');
      const newStudents = await bulkRegisterStudents(fileData);
      setUploadStatus('업로드 성공!');
      if (onBulkUpload) {
        onBulkUpload(newStudents);
      }
    } catch (error) {
      console.error('대량 등록 에러:', error);
      setUploadStatus('업로드 실패!');
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <h3>엑셀 일괄 업로드</h3>
      <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />
      {fileData && (
        <div>
          <button onClick={handleBulkUpload}>대량 등록 실행</button>
          <p>{uploadStatus}</p>
        </div>
      )}
    </div>
  );
}
