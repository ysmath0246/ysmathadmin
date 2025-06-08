/**
 * migrate-available-points.js
 * Firestore 포인트 마이그레이션 스크립트
 *
 * - totalPoints: data.points 객체의 서브필드 합계
 * - usedPoints: point_logs 컬렉션에서 studentId로 조회된 로그의 합계
 * - availablePoints = totalPoints - usedPoints
 */

const admin = require('firebase-admin');

// 1) 서비스 계정 키 또는 Application Default Credentials 설정
//    env: export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  // databaseURL이 필요하면 추가
  // databaseURL: 'https://<YOUR_PROJECT_ID>.firebaseio.com'
});

const db = admin.firestore();

(async () => {
  try {
    // 2) App.jsx 의 points 구조에 맞춰서 필드명 리스트 작성
    const pointFields = ["출석", "숙제", "수업태도", "시험", "문제집완료"];

    const studentsSnap = await db.collection('students').get();
    console.log(`총 ${studentsSnap.size}명 학생 대상 마이그레이션 시작…`);

    for (const doc of studentsSnap.docs) {
      const studentId = doc.id;
      const data = doc.data();
      const name = data.name || studentId;

      // 3) 총 포인트 합계 계산
      const totalPoints = pointFields
        .map(key => data.points?.[key] || 0)
        .reduce((sum, v) => sum + v, 0);

      // 4) 사용된 포인트 합계 계산
      const logsSnap = await db
        .collection('point_logs')
        .where('studentId', '==', studentId)
        .get();

      const usedPoints = logsSnap.docs
        .map(d => d.data().point || 0)
        .reduce((sum, v) => sum + v, 0);

      // 5) 가용포인트 계산 및 업데이트
      const availablePoints = totalPoints - usedPoints;
      await db.collection('students').doc(studentId)
        .update({ availablePoints });

      console.log(`✅ ${name}: total=${totalPoints}, used=${usedPoints}, available=${availablePoints}`);
    }

    console.log('🎉 모든 학생 가용포인트 업데이트 완료!');
    process.exit(0);

  } catch (err) {
    console.error('❌ 마이그레이션 실패:', err);
    process.exit(1);
  }
})();
