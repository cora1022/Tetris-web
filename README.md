# Cora 테트리스

블록을 움직이고 회전해 가로줄을 완성하는 가벼운 정적 웹 게임입니다.

- 운영 주소: <https://tetris.cora1022.com>
- 기술: HTML, CSS, JavaScript, Canvas
- 저장 정보: 최고 점수와 방문 통계 동의 여부
- 문의: 7ipvpp@gmail.com

## 로컬 실행

```powershell
python -m http.server 4173 --directory public
```

`http://localhost:4173`에서 확인합니다. ES 모듈을 사용하므로 `index.html`을 파일로 직접 여는 대신 로컬 서버를 사용합니다.

## 테스트

```powershell
npm test
```

## 배포

Netlify에서 이 저장소를 연결하고 배포 폴더를 `public`으로 설정합니다. 빌드 명령은 필요하지 않습니다. 운영 도메인은 `tetris.cora1022.com`, 기본 Netlify 주소는 `tetris-cora1022.netlify.app`을 사용합니다.

## 광고

광고 설정은 `public/assets/js/ads.js`에 있으며 기본값은 비활성화입니다. AdSense 승인 후 광고 단위 ID와 동의 절차를 확인한 뒤 활성화합니다.
