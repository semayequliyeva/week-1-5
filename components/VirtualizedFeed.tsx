'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FeedItem } from '../types/virtualList';
import { generateMockItems } from '../utils/mockData';

const DEFAULT_ITEM_HEIGHT = 140; // Texmini susmaya gore hundurluk (px)
const OVERSCAN_BUFFER = 4; // Yuxari ve asagidan bufer setir sayi
const PAGE_SIZE = 50; // Her sehife ucun elave olunan element sayi

export default function VirtualizedFeed() {
  // Siyahidaki butun elementler
  const [items, setItems] = useState<FeedItem[]>(() => generateMockItems(0, 100));
  // Scroll movqeyi ve konteyner hundurluyu
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(600);
  // Yuklenme veziyyeti (In-flight guard)
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  // Klaviatura naviqasiyasi ucun fokuslanmis indeks
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  // Müəyyən indeksə tullanmaq üçün daxiletmə steyti
  const [jumpInput, setJumpInput] = useState<string>('');

  // DOM ref-leri
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Olculmus hundurluklerin keslenmesi (Map: item.id -> actualHeightInPx)
  const measuredHeightsRef = useRef<Map<string, number>>(new Map());
  const [, forceUpdate] = useState({});

  // 1. ResizeObserver vasitesile render olunan setirlerin real hundurluklerini olcmek
  const rowRefCallback = useCallback((node: HTMLDivElement | null, itemId: string) => {
    if (!node) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const measuredHeight = Math.round(entry.borderBoxSize[0]?.blockSize || entry.contentRect.height);
        const currentHeight = measuredHeightsRef.current.get(itemId);

        // Eger olculen hundurluk evvelkiden ferqlidirse kese yaz ve update et
        if (measuredHeight > 0 && currentHeight !== measuredHeight) {
          measuredHeightsRef.current.set(itemId, measuredHeight);
          // Hundurluk deyisdikde ofsetlerin yeniden hesablanmasi ucun render tetikle
          forceUpdate({});
        }
      }
    });

    resizeObserver.observe(node);
  }, []);

  // 2. Kumulyativ ofsetlerin (Cumulative Offsets) hesablanmasi
  const { offsets, totalHeight } = useMemo(() => {
    const offsetsArr: number[] = new Array(items.length);
    let currentOffset = 0;

    for (let i = 0; i < items.length; i++) {
      offsetsArr[i] = currentOffset;
      const h = measuredHeightsRef.current.get(items[i].id) || DEFAULT_ITEM_HEIGHT;
      currentOffset += h;
    }

    return {
      offsets: offsetsArr,
      totalHeight: currentOffset,
    };
  }, [items]);

  // 3. Binary Search vasitesile scrollTop-a gore gorunen ilk indeksi tapmaq
  const findStartIndex = useCallback(
    (targetScrollTop: number): number => {
      let low = 0;
      let high = items.length - 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const offset = offsets[mid] || 0;

        if (offset === targetScrollTop) return mid;
        if (offset < targetScrollTop) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      return Math.max(0, low - 1);
    },
    [items.length, offsets]
  );

  // 4. Gorunen diapazonun (Visible Slice) va Buffer-in hesablanmasi
  const { startIndex, endIndex, visibleItems } = useMemo(() => {
    if (items.length === 0) return { startIndex: 0, endIndex: 0, visibleItems: [] };

    const rawStart = findStartIndex(scrollTop);
    const start = Math.max(0, rawStart - OVERSCAN_BUFFER);

    let end = rawStart;
    while (end < items.length && (offsets[end] || 0) < scrollTop + containerHeight) {
      end++;
    }
    end = Math.min(items.length - 1, end + OVERSCAN_BUFFER);

    const visibleSlice = items.slice(start, end + 1).map((item, localIdx) => ({
      item,
      index: start + localIdx,
      topOffset: offsets[start + localIdx] || 0,
    }));

    return {
      startIndex: start,
      endIndex: end,
      visibleItems: visibleSlice,
    };
  }, [items, scrollTop, containerHeight, findStartIndex, offsets]);

  // 5. Throttled Scroll Handler (requestAnimationFrame istifade olunur)
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
    });
  }, []);

  // Konteyner olcusunun dinamik hesablanmasi
  useEffect(() => {
    if (!containerRef.current) return;
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // 6. Infinite Scroll sentinel observer (IntersectionObserver)
  const loadMoreChunk = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);

    // Suni sebeke yubanmasi (500ms)
    setTimeout(() => {
      setItems((prev) => [...prev, ...generateMockItems(prev.length, PAGE_SIZE)]);
      setIsLoadingMore(false);
    }, 500);
  }, [isLoadingMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMoreChunk();
        }
      },
      { root: containerRef.current, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreChunk, isLoadingMore]);

  // 7. Mueyyen indekse tullanmaq funksiyasi (Scroll-To-Item)
  const scrollToIndex = (index: number) => {
    if (index < 0 || index >= items.length || !containerRef.current) return;
    const targetOffset = offsets[index] || 0;
    containerRef.current.scrollTo({
      top: targetOffset,
      behavior: 'smooth',
    });
    setFocusedIndex(index);
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const idx = parseInt(jumpInput, 10) - 1;
    if (!isNaN(idx)) {
      scrollToIndex(idx);
    }
  };

  // 8. Klaviatura Naviqasiyasi (Arrow Up / Arrow Down)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.min(items.length - 1, focusedIndex + 1);
      scrollToIndex(nextIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = Math.max(0, focusedIndex - 1);
      scrollToIndex(prevIdx);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800">
      {/* Ust Panel: Statistikalar ve Idareetme */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b dark:border-gray-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Virtualized Infinite Feed</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manual windowing with dynamic heights, rAF scroll throttling, and zero charting/virtualization libraries.
          </p>
        </div>

        {/* Indekse Tullanmaq Formu */}
        <form onSubmit={handleJumpSubmit} className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max={items.length}
            placeholder={`1 - ${items.length}`}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            className="w-28 text-xs p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            Jump
          </button>
        </form>
      </div>

      {/* Performans Metrikleri Paneli */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-xs font-medium">
        <div>
          <span className="text-gray-400 block">Total Items Loaded</span>
          <span className="text-base font-bold text-blue-600 dark:text-blue-400">{items.length.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-400 block">Rendered DOM Nodes</span>
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{visibleItems.length}</span>
        </div>
        <div>
          <span className="text-gray-400 block">Visible Window</span>
          <span className="text-base font-bold text-purple-600 dark:text-purple-400">
            #{startIndex + 1} - #{endIndex + 1}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block">Total Scroll Height</span>
          <span className="text-base font-bold text-amber-600 dark:text-amber-400">
            {Math.round(totalHeight).toLocaleString()} px
          </span>
        </div>
      </div>

      {/* Əsas Virtualized Scroll Konteyneri */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label="Virtualized Infinite Feed. Use Arrow Up and Down keys to navigate items."
        className="relative h-[550px] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {/* Spacer Div: Umumi kecid hundurluyunu yaradan bos qat */}
        <div style={{ height: `${totalHeight}px`, width: '100%', position: 'relative' }}>
          {/* Yalniz pencerede gorunen elementler absolute olaraq yerlesdirilir */}
          {visibleItems.map(({ item, index, topOffset }) => {
            const isFocused = focusedIndex === index;

            return (
              <div
                key={item.id}
                ref={(node) => rowRefCallback(node, item.id)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${topOffset}px)`,
                  willChange: 'transform',
                }}
                onClick={() => setFocusedIndex(index)}
                className="p-3"
              >
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    isFocused
                      ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 shadow-md'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      #{index + 1} • {item.category}
                    </span>
                    <span>{item.timestamp}</span>
                  </div>

                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1.5">{item.title}</h3>

                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-3">{item.content}</p>

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span>By {item.author}</span>
                    <span>♥ {item.likes} likes</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Infinite Scroll Sentinel & Yüklenme Skeleti (Skeleton Placeholders) */}
        <div ref={sentinelRef} className="p-4">
          {isLoadingMore && (
            <div className="space-y-3">
              {[1, 2].map((sk) => (
                <div
                  key={sk}
                  className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse space-y-2"
                >
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                </div>
              ))}
              <p className="text-center text-xs text-gray-400 italic">Loading more items...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}