import { MOCK_LIVE_STREAMS, MOCK_LIVE_UPDATES } from './mockData';
import { LiveStream, LiveStreamStatus, LiveUpdate, LiveUpdateType } from './types';

const STREAMS_STORAGE_KEY = 'cc_live_streams_v1';
const UPDATES_STORAGE_KEY = 'cc_live_updates_v1';
const STREAMS_API = '/api/live_streams.php';
const UPDATES_API = '/api/live_updates.php';

const getAdminToken = () => {
  try {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
  } catch {
    return null;
  }
};

const generateId = () => Math.random().toString(36).slice(2, 10);

const normalizeStream = (stream: any): LiveStream => {
  const createdAt = stream?.createdAt || new Date().toISOString();
  return {
    id: stream?.id || generateId(),
    slug: stream?.slug || '',
    title: stream?.title || '',
    lead: stream?.lead || '',
    body: stream?.body || '',
    coverImage: stream?.coverImage || '',
    category: stream?.category,
    tags: Array.isArray(stream?.tags) ? stream.tags : [],
    status: (stream?.status as LiveStreamStatus) || 'draft',
    pinned: !!stream?.pinned,
    pinnedOrder: typeof stream?.pinnedOrder === 'number' ? stream.pinnedOrder : 0,
    createdAt,
    updatedAt: stream?.updatedAt || createdAt,
  };
};

const normalizeUpdate = (update: any): LiveUpdate => {
  const createdAt = update?.createdAt || new Date().toISOString();
  return {
    id: update?.id || generateId(),
    liveStreamId: update?.liveStreamId || '',
    eventTime: update?.eventTime || createdAt,
    text: update?.text || '',
    type: (update?.type as LiveUpdateType) || 'update',
    sourceName: update?.sourceName || '',
    sourceUrl: update?.sourceUrl || '',
    mediaUrl: update?.mediaUrl || '',
    createdAt,
    updatedAt: update?.updatedAt || createdAt,
  };
};

const normalizeStreams = (streams: any[]): LiveStream[] => (Array.isArray(streams) ? streams : []).map(normalizeStream);
const normalizeUpdates = (updates: any[]): LiveUpdate[] => (Array.isArray(updates) ? updates : []).map(normalizeUpdate);

const isPublicVisible = (stream: LiveStream, now = new Date()) => {
  const status = stream.status || 'draft';
  if (status !== 'published' && status !== 'finished') return false;
  const createdAt = new Date(stream.createdAt);
  if (Number.isNaN(createdAt.getTime())) return false;
  return createdAt.getTime() <= now.getTime();
};

let streamsCache: LiveStream[] = [];
let updatesCache: LiveUpdate[] = [];
let isInitialized = false;

const saveLocal = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage save skipped:', e);
  }
};

const saveRemote = async (url: string, payload: any) => {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(getAdminToken() ? { 'X-Admin-Token': getAdminToken() as string } : {}) },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('Failed to sync with server', e);
  }
};

const getLatestCursor = (updates: LiveUpdate[]) => {
  return updates.reduce((latest, update) => {
    const created = new Date(update.createdAt).getTime();
    return created > latest ? created : latest;
  }, 0);
};

const updateStreamTimestamp = (streamId: string, timestamp = new Date().toISOString()) => {
  streamsCache = streamsCache.map(stream =>
    stream.id === streamId
      ? { ...stream, updatedAt: timestamp }
      : stream
  );
};

const sortUpdatesByEvent = (updates: LiveUpdate[], direction: 'asc' | 'desc') => {
  return [...updates].sort((a, b) => {
    const diff = new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime();
    if (diff !== 0) return direction === 'asc' ? diff : -diff;
    return direction === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
  });
};

export const liveService = {
  init: async (): Promise<void> => {
    if (isInitialized) return;
    try {
      const [streamsRes, updatesRes] = await Promise.all([fetch(STREAMS_API), fetch(UPDATES_API)]);
      if (!streamsRes.ok || !updatesRes.ok) {
        throw new Error('Live API not available');
      }
      const streamsData = await streamsRes.json();
      const updatesData = await updatesRes.json();
      if (Array.isArray(streamsData) && streamsData.length > 0) {
        streamsCache = normalizeStreams(streamsData);
      } else {
        streamsCache = normalizeStreams([...MOCK_LIVE_STREAMS]);
      }
      if (Array.isArray(updatesData) && updatesData.length > 0) {
        updatesCache = normalizeUpdates(updatesData);
      } else {
        updatesCache = normalizeUpdates([...MOCK_LIVE_UPDATES]);
      }
    } catch (e) {
      console.warn('Live backend connection failed, using localStorage/Mocks', e);
      const storedStreams = typeof window !== 'undefined' ? localStorage.getItem(STREAMS_STORAGE_KEY) : null;
      const storedUpdates = typeof window !== 'undefined' ? localStorage.getItem(UPDATES_STORAGE_KEY) : null;
      streamsCache = storedStreams ? normalizeStreams(JSON.parse(storedStreams)) : normalizeStreams([...MOCK_LIVE_STREAMS]);
      updatesCache = storedUpdates ? normalizeUpdates(JSON.parse(storedUpdates)) : normalizeUpdates([...MOCK_LIVE_UPDATES]);
    }
    isInitialized = true;
  },

  save: async () => {
    saveLocal(STREAMS_STORAGE_KEY, streamsCache);
    saveLocal(UPDATES_STORAGE_KEY, updatesCache);
    await Promise.all([saveRemote(STREAMS_API, streamsCache), saveRemote(UPDATES_API, updatesCache)]);
  },

  getAllAdmin: (): LiveStream[] => {
    return [...streamsCache].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  getPublished: (): LiveStream[] => {
    return streamsCache.filter(stream => isPublicVisible(stream));
  },

  getPinned: (): LiveStream[] => {
    return streamsCache
      .filter(stream => stream.pinned && isPublicVisible(stream))
      .sort((a, b) => (a.pinnedOrder || 0) - (b.pinnedOrder || 0));
  },

  getById: (id: string): LiveStream | undefined => {
    return streamsCache.find(stream => stream.id === id);
  },

  getBySlug: (slug: string): LiveStream | undefined => {
    return streamsCache.find(stream => stream.slug === slug);
  },

  getUpdatesByStreamId: (streamId: string, direction: 'asc' | 'desc' = 'desc'): LiveUpdate[] => {
    return sortUpdatesByEvent(updatesCache.filter(update => update.liveStreamId === streamId), direction);
  },

  createStream: async (payload: LiveStream) => {
    const stream = normalizeStream({
      ...payload,
      id: payload.id || generateId(),
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: payload.updatedAt || new Date().toISOString(),
    });
    streamsCache = [stream, ...streamsCache];
    await liveService.save();
    return stream;
  },

  updateStream: async (id: string, updates: Partial<LiveStream>) => {
    streamsCache = streamsCache.map(stream =>
      stream.id === id ? normalizeStream({ ...stream, ...updates, id: stream.id }) : stream
    );
    await liveService.save();
  },

  updateStatus: async (id: string, status: LiveStreamStatus) => {
    await liveService.updateStream(id, { status, updatedAt: new Date().toISOString() });
  },

  togglePinned: async (id: string, pinned: boolean, order?: number) => {
    await liveService.updateStream(id, { pinned, pinnedOrder: pinned ? order || 1 : 0 });
  },

  deleteStream: async (id: string) => {
    streamsCache = streamsCache.filter(stream => stream.id !== id);
    updatesCache = updatesCache.filter(update => update.liveStreamId !== id);
    await liveService.save();
  },

  addUpdate: async (streamId: string, payload: Omit<LiveUpdate, 'id' | 'liveStreamId' | 'createdAt' | 'updatedAt'>) => {
    const timestamp = new Date().toISOString();
    const update = normalizeUpdate({
      ...payload,
      id: generateId(),
      liveStreamId: streamId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    updatesCache = [update, ...updatesCache];
    updateStreamTimestamp(streamId, timestamp);
    await liveService.save();
    return update;
  },

  updateUpdate: async (updateId: string, updates: Partial<LiveUpdate>) => {
    const timestamp = new Date().toISOString();
    let streamId: string | null = null;
    updatesCache = updatesCache.map(update => {
      if (update.id !== updateId) return update;
      streamId = update.liveStreamId;
      return normalizeUpdate({ ...update, ...updates, id: update.id, updatedAt: timestamp });
    });
    if (streamId) updateStreamTimestamp(streamId, timestamp);
    await liveService.save();
  },

  deleteUpdate: async (updateId: string) => {
    const update = updatesCache.find(item => item.id === updateId);
    updatesCache = updatesCache.filter(item => item.id !== updateId);
    if (update) {
      updateStreamTimestamp(update.liveStreamId, new Date().toISOString());
    }
    await liveService.save();
  },

  moveUpdate: async (streamId: string, updateId: string, direction: 'up' | 'down') => {
    const sorted = liveService.getUpdatesByStreamId(streamId, 'desc');
    const index = sorted.findIndex(item => item.id === updateId);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= sorted.length) return;
    const current = sorted[index];
    const target = sorted[swapWith];
    updatesCache = updatesCache.map(update => {
      if (update.id === current.id) return { ...update, eventTime: target.eventTime };
      if (update.id === target.id) return { ...update, eventTime: current.eventTime };
      return update;
    });
    updateStreamTimestamp(streamId, new Date().toISOString());
    await liveService.save();
  },

  fetchUpdatesAfter: async (streamId: string, after?: number) => {
    const cursor = after ?? getLatestCursor(liveService.getUpdatesByStreamId(streamId, 'asc'));
    try {
      const res = await fetch(`${UPDATES_API}?streamId=${encodeURIComponent(streamId)}&after=${cursor}`);
      if (!res.ok) throw new Error('Failed to load updates');
      const data = await res.json();
      const incoming = normalizeUpdates(data);
      if (incoming.length > 0) {
        const existingIds = new Set(updatesCache.map(update => update.id));
        const merged = incoming.filter(update => !existingIds.has(update.id));
        if (merged.length > 0) {
          updatesCache = [...merged, ...updatesCache];
          updateStreamTimestamp(streamId, new Date().toISOString());
        }
      }
      return incoming;
    } catch (e) {
      console.warn('Failed to fetch updates after cursor', e);
      return [];
    }
  },
};
