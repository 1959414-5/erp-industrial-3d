import * as THREE from 'three';

// Chão da fábrica desenhado (canvas): zonas, corredores com setas, faixa de
// pedestre e rótulos — layout 104×72 (referência HTML).
// coluna = X do mundo; linha = Z (topo = fundo).

const FW = 104, FD = 72;
const W = 4160, H = 2880;   // resolução proporcional ao novo tamanho

export function buildFloor(): THREE.Mesh {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const X = (wx: number) => (wx + FW / 2) / FW * W;
  const Z = (wz: number) => (wz + FD / 2) / FD * H;
  const S = (u: number) => (u / FW) * W;

  // base de concreto + juntas
  g.fillStyle = '#e6eaef'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(112,126,143,.14)'; g.lineWidth = 2;
  for (let x = -52; x <= 52; x += 5) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), H); g.stroke(); }
  for (let z = -36; z <= 36; z += 5) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(W, Z(z)); g.stroke(); }

  const zone = (x0: number, z0: number, x1: number, z1: number, fill: string, edge: string) => {
    const x = X(x0), y = Z(z0), w = X(x1) - x, h = Z(z1) - y;
    g.save();
    g.fillStyle = fill; g.fillRect(x, y, w, h);
    g.strokeStyle = edge; g.lineWidth = 3; g.setLineDash([22, 15]);
    g.strokeRect(x + 2, y + 2, w - 4, h - 4);
    g.setLineDash([]);
    g.restore();
  };
  const hazard = (x0: number, z0: number, x1: number, z1: number) => {
    const bw = S(0.5);
    g.save();
    g.beginPath(); g.rect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
    g.rect(X(x0) + bw, Z(z0) + bw, X(x1) - X(x0) - 2 * bw, Z(z1) - Z(z0) - 2 * bw);
    g.clip('evenodd');
    g.fillStyle = '#e9c45a'; g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
    g.strokeStyle = '#2b2f36'; g.lineWidth = bw * 0.55;
    for (let i = -H; i < W + H; i += bw * 1.4) { g.beginPath(); g.moveTo(X(x0) + i, Z(z0)); g.lineTo(X(x0) + i - (Z(z1) - Z(z0)), Z(z1)); g.stroke(); }
    g.restore();
  };
  const lane = (x0: number, z0: number, x1: number, z1: number, wpx = 12) => {
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(39,51,66,.24)'; g.lineWidth = wpx + 7;
    g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke();
    g.strokeStyle = '#e5b638'; g.lineWidth = wpx;
    g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke();
  };
  const chevronH = (x: number, z: number, dir = 1) => {
    const s = S(0.7); g.strokeStyle = 'rgba(245,197,24,.9)'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(X(x) - s * dir, Z(z) - s); g.lineTo(X(x), Z(z)); g.lineTo(X(x) - s * dir, Z(z) + s); g.stroke();
  };
  const chevronV = (x: number, z: number, dir = -1) => {
    const s = S(0.7); g.strokeStyle = 'rgba(245,197,24,.9)'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(X(x) - s, Z(z) - s * dir); g.lineTo(X(x), Z(z)); g.lineTo(X(x) + s, Z(z) - s * dir); g.stroke();
  };
  const crosswalk = (x0: number, x1: number, z: number) => {
    const n = 8, step = (X(x1) - X(x0)) / n;
    // fundo preto atrás da faixa
    g.fillStyle = 'rgba(30,30,40,.25)'; g.fillRect(X(x0) - S(0.2), Z(z) - S(1.2), X(x1) - X(x0) + S(0.4), S(2.4));
    // listras brancas grossas
    g.fillStyle = '#f0f4f8';
    for (let i = 0; i < n; i += 1) g.fillRect(X(x0) + i * step + step * 0.12, Z(z) - S(1.0), step * 0.6, S(2.0));
  };

  // ── ZONAS ─────────────────────────────────────────────────────
  // Produção (centro-esquerda, onde ficam as máquinas)
  zone(-39, -17, 14, 7, 'rgba(59,130,246,.075)', 'rgba(59,130,246,.36)');
  // Estoque (direita, com paletes e porta-paletes)
  zone(18, -34, 51, 10, 'rgba(242,167,27,.075)', 'rgba(217,139,38,.38)');
  // Expedição (frente-esquerda)
  zone(-48, 15, -25, 34, 'rgba(34,181,115,.085)', 'rgba(34,145,105,.38)');
  // Comercial/Escritório (frente-direita)
  zone(5.5, 11, 49, 30, 'rgba(124,92,252,.06)', 'rgba(124,92,252,.32)');

  // ── ESTACIONAMENTO (asfalto escuro + vagas + símbolo P) ──────
  g.fillStyle = '#6b7280'; g.fillRect(X(-23), Z(14), X(-1) - X(-23), Z(36) - Z(14));
  // borda do estacionamento
  g.strokeStyle = '#f7fafc'; g.lineWidth = 6;
  g.strokeRect(X(-23) + 3, Z(14) + 3, X(-1) - X(-23) - 6, Z(36) - Z(14) - 6);
  // vagas — linhas brancas verticais (2 fileiras)
  g.strokeStyle = '#eef2f6'; g.lineWidth = 5;
  for (let x = -21; x <= -3; x += 4) {
    g.beginPath(); g.moveTo(X(x), Z(15)); g.lineTo(X(x), Z(22)); g.stroke();   // fileira de cima
    g.beginPath(); g.moveTo(X(x), Z(27)); g.lineTo(X(x), Z(34)); g.stroke();   // fileira de baixo
  }
  // linhas horizontais delimitando fileiras
  g.beginPath(); g.moveTo(X(-23), Z(22)); g.lineTo(X(-1), Z(22)); g.stroke();
  g.beginPath(); g.moveTo(X(-23), Z(27)); g.lineTo(X(-1), Z(27)); g.stroke();
  // corredor interno do parking (entre fileiras)
  g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(X(-23), Z(22), X(-1) - X(-23), Z(27) - Z(22));
  // setas de direção no corredor interno
  for (let x = -20; x <= -6; x += 7) chevronH(x, 24.5, 1);
  // símbolo P grande
  g.fillStyle = 'rgba(255,255,255,.22)'; g.font = '900 500px Inter, Arial';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('P', X(-12), Z(24.5));

  // perímetros zebrados
  hazard(-39, -17, 14, 7);          // produção
  hazard(19.5, -14.5, 48.5, 8.5);   // grade de paletes do estoque
  hazard(-48, 15, -25, 34);          // expedição

  // faixa verde de pedestre (lateral esquerda)
  // Continuidade da faixa verde lateral até a entrada da Expedição (limite z=14.5).
  const pedestrianLaneEnd = 14.5;
  g.fillStyle = 'rgba(34,181,115,.32)';
  g.fillRect(X(-51), Z(-34), S(3), Z(pedestrianLaneEnd) - Z(-34));
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.setLineDash([26, 20]);
  g.beginPath(); g.moveTo(X(-49.5), Z(-34)); g.lineTo(X(-49.5), Z(pedestrianLaneEnd)); g.stroke();
  g.beginPath(); g.moveTo(X(-48.5), Z(-34)); g.lineTo(X(-48.5), Z(pedestrianLaneEnd)); g.stroke(); g.setLineDash([]);
  // ícone pedestre
  g.fillStyle = 'rgba(34,181,115,.6)'; g.font = 'bold 100px Inter, Arial';
  g.textAlign = 'center'; g.fillText('🚶', X(-49.5), Z(-10));

  // ── CORREDORES (amarelos) + SETAS ─────────────────────────────
  // corredor traseiro (z = -19.5, liga cruzamento x=-38 ao estoque)
  lane(-40, -19.5, 15, -19.5);
  // corredor lateral esquerdo (x = -38, vertical)
  lane(-38, -32, -38, 8);
  // corredor de empilhadeira produção↔estoque (x = +15.8)
  lane(15.8, -30, 15.8, 10);
  // corredor frontal (z ≈ 10, separa produção/estoque do escritório/expedição)
  lane(-48, 10, 5, 10);

  // setas — corredor traseiro
  for (let x = -36; x <= 12; x += 8) chevronH(x, -19.5, 1);
  // setas — corredor lateral esq
  for (let z = -28; z <= 4; z += 8) chevronV(-38, z, -1);
  // setas — corredor empilhadeira
  for (let z = -26; z <= 6; z += 8) chevronV(15.8, z, -1);
  // setas — corredor frontal
  for (let x = -44; x <= 0; x += 8) chevronH(x, 10, 1);

  // faixas de pedestre (cruzamentos chave)
  crosswalk(14, 18, -19.5);     // entrada do estoque (corredor traseiro)
  crosswalk(3, 7, 10);          // frente do escritório (corredor frontal)
  crosswalk(-40, -36, 10);      // cruzamento lateral esq + frontal
  crosswalk(14, 18, 10);        // cruzamento empilhadeira + frontal
  crosswalk(-24, -20, 15);      // entrada do estacionamento
  crosswalk(-40, -36, -19.5);   // cruzamento lateral esq + traseiro

  // faixa pedestre verde no corredor pedestre paralelo (z=-22)
  g.fillStyle = 'rgba(34,181,115,.30)'; g.fillRect(X(-40), Z(-23.5), X(14) - X(-40), S(3));
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.setLineDash([20, 16]);
  g.beginPath(); g.moveTo(X(-40), Z(-23.5)); g.lineTo(X(14), Z(-23.5)); g.stroke();
  g.beginPath(); g.moveTo(X(-40), Z(-20.5)); g.lineTo(X(14), Z(-20.5)); g.stroke(); g.setLineDash([]);

  // faixa pedestre verde no corredor pedestre lateral (x=13)
  g.fillStyle = 'rgba(34,181,115,.30)'; g.fillRect(X(11.5), Z(-25), S(3), Z(5) - Z(-25));
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.setLineDash([20, 16]);
  g.beginPath(); g.moveTo(X(11.5), Z(-25)); g.lineTo(X(11.5), Z(5)); g.stroke();
  g.beginPath(); g.moveTo(X(14.5), Z(-25)); g.lineTo(X(14.5), Z(5)); g.stroke(); g.setLineDash([]);

  // faixa pedestre verde no corredor frontal de pedestres (z=13)
  g.fillStyle = 'rgba(34,181,115,.25)'; g.fillRect(X(-45), Z(11.5), X(5) - X(-45), S(3));
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.setLineDash([20, 16]);
  g.beginPath(); g.moveTo(X(-45), Z(11.5)); g.lineTo(X(5), Z(11.5)); g.stroke();
  g.beginPath(); g.moveTo(X(-45), Z(14.5)); g.lineTo(X(5), Z(14.5)); g.stroke(); g.setLineDash([]);

  // ── RÓTULOS DOS SETORES ───────────────────────────────────────
  const floorLabel = (title: string, subtitle: string, x: number, z: number, titleSize: number, subSize: number) => {
    g.save();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${titleSize}px Inter, Arial`;
    g.fillStyle = 'rgba(31,42,68,0.24)';
    g.fillText(title, X(x), Z(z));
    g.font = `700 ${subSize}px Inter, Arial`;
    g.fillStyle = 'rgba(31,42,68,0.34)';
    g.fillText(subtitle, X(x), Z(z + 2.0));
    g.restore();
  };
  floorLabel('PRODUÇÃO', 'CORTE  ·  CONFORMAÇÃO  ·  USINAGEM', -13, 5.5, 180, 42);
  floorLabel('ESTOQUE', 'MATÉRIA-PRIMA  ·  CHAPAS', 35, -5, 170, 40);
  floorLabel('EXPEDIÇÃO', 'RECEBIMENTO  ·  CARREGAMENTO', -36.5, 25, 130, 34);
  floorLabel('COMERCIAL', 'ATENDIMENTO  ·  VENDAS', 27, 13, 140, 38);
  // rótulo do estacionamento (topo do asfalto, abaixo do P)
  g.fillStyle = 'rgba(255,255,255,.22)'; g.font = '900 90px Inter, Arial';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ESTACIONAMENTO', X(-12), Z(34));

  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.96, metalness: 0 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.receiveShadow = true;
  return m;
}
