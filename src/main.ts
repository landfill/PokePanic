import { scoreContact } from './game/scoring';

const status = document.querySelector('#readiness');
if (status) {
  const result = scoreContact({ powerPercent: 60, contact: { u: 0, v: 0 } });
  status.textContent = '기준 계산 확인: 파워 60% · 정중앙 최대 ' + result.maxRawScore + '점';
}
