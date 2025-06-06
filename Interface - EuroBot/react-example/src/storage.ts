import localforage from 'localforage';

// Meta (inspeção) store
export const metaStore = localforage.createInstance({
  name: 'inspecao',
  storeName: 'meta'
});

// Photo (blob) store
export const photoStore = localforage.createInstance({
  name: 'inspecao',
  storeName: 'fotos'
});

// Timer store: armazena elapsedTime
export const timerStore = localforage.createInstance({
  name: 'inspecao',
  storeName: 'timer'
});

// Battery store: armazena lowStart e countdown
export const batteryStore = localforage.createInstance({
  name: 'inspecao',
  storeName: 'battery'
});

// helpers para batteryStore
export async function setLowStart(ts: number | null) {
  if (ts === null) {
    await batteryStore.removeItem('lowStart');
  } else {
    await batteryStore.setItem('lowStart', ts);
  }
}

export async function getLowStart(): Promise<number | null> {
  const v = await batteryStore.getItem<number>('lowStart');
  return v ?? null;
}

export async function setCountdown(sec: number | null) {
  if (sec === null) {
    await batteryStore.removeItem('countdown');
  } else {
    await batteryStore.setItem('countdown', sec);
  }
}

export async function getCountdown(): Promise<number | null> {
  const v = await batteryStore.getItem<number>('countdown');
  return v ?? null;
}

// helpers para timerStore


export async function getElapsedTime(): Promise<number> {
  const v = await timerStore.getItem<number>('elapsedTime');
  return v ?? 0;
}

/** grava o valor no IndexedDB */
export async function setElapsedTimeRemote(value: number): Promise<void> {
  await timerStore.setItem('elapsedTime', value);
}
