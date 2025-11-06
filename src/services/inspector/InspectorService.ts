import type { Scene } from '@babylonjs/core';

import { ensureInspector } from './ensureInspector';

const Q = '.babylonjsInspector, #sceneExplorer';

export async function showEmbeddedInspector(
  args: { scene: Scene | undefined; host: HTMLElement | null }
): Promise<void> {
  if (!args?.scene) {
    console.warn('[showEmbeddedInspector] Scene not provided');
    return;
  }
  if (!args?.host) {
    console.warn('[showEmbeddedInspector] Host element not provided');
    return;
  }

  console.log('[showEmbeddedInspector] Starting...');

  // Ensure Inspector bundle is loaded (even if Inspector class doesn't exist separately)
  // In Babylon.js 8.x, Inspector is integrated into DebugLayer
  await ensureInspector();

  try {
    await args.scene.debugLayer.hide();
  } catch (err) {
    console.warn('[showEmbeddedInspector] Error hiding debug layer:', err);
  }

  try {
    console.log('[showEmbeddedInspector] Calling debugLayer.show()...');
    // CRITICAL: Pass the host as rootElement so Inspector attaches directly
    // This should make it work "by default" without needing to move DOM elements
    await args.scene.debugLayer.show({
      embedMode: true,
      overlay: false,
      enablePopup: false,
      rootElement: args.host,
      parentElement: args.host,
      globalRoot: args.host
    } as any);
    console.log('[showEmbeddedInspector] debugLayer.show() completed');
  } catch (err) {
    console.error('[showEmbeddedInspector] Error showing debug layer:', err);
    throw err;
  }

  // Wait for Inspector DOM to be created
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const host = args.host; // host is guaranteed non-null after guard above
  
  // Check if Inspector attached directly to host (it should if rootElement worked)
  const root = host.querySelector(Q) as HTMLElement | null;
  if (root && host.contains(root)) {
    console.log('[showEmbeddedInspector] ✅ Inspector attached directly to host - should work by default');
  } else {
    console.warn('[showEmbeddedInspector] ⚠️ Inspector NOT in host - will need to adopt (this may break auto-refresh)');
  }
  
  // CRITICAL: Force the entire ancestor chain to flex immediately
  // Walk up from host to find all Dockview containers and force them to flex
  let current: HTMLElement | null = host;
  const ancestors: HTMLElement[] = [];
  while (current && ancestors.length < 15) {
    ancestors.push(current);
    current = current.parentElement;
  }
  
  // Apply flex to all ancestors that need it
  ancestors.forEach((el, idx) => {
    const className = el.className || '';
    const isDockview = className.includes('dv-') || className.includes('dockview');
    
    // Force flex on Dockview containers and inspector-pane
    if (isDockview || el.classList.contains('inspector-pane') || idx < 5) {
      el.style.setProperty('display', 'flex', 'important');
      el.style.setProperty('flex-direction', 'column', 'important');
      el.style.setProperty('width', '100%', 'important');
      el.style.setProperty('height', '100%', 'important');
      el.style.setProperty('min-width', '0', 'important');
      el.style.setProperty('min-height', '0', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
    }
  });
  
  // CRITICAL: Wait for host to have size - use both ResizeObserver AND polling
  // The ResizeObserver might not fire if the element isn't in the layout yet
  await new Promise<void>((resolve) => {
    if (host.clientWidth > 0 && host.clientHeight > 0) {
      console.log(`[showEmbeddedInspector] Host already has size: ${host.clientWidth}x${host.clientHeight}`);
      resolve();
      return;
    }
    
    let resolved = false;
    let pollCount = 0;
    const maxPolls = 100; // 10 seconds at 100ms intervals
    
    // Polling fallback (more reliable for initial mount)
    const poll = setInterval(() => {
      pollCount++;
      if (host.clientWidth > 0 && host.clientHeight > 0) {
        resolved = true;
        clearInterval(poll);
        if (ro) ro.disconnect();
        console.log(`[showEmbeddedInspector] Host got size via polling (${pollCount} attempts): ${host.clientWidth}x${host.clientHeight}`);
        resolve();
        return;
      }
      if (pollCount >= maxPolls) {
        resolved = true;
        clearInterval(poll);
        if (ro) ro.disconnect();
        // If still zero, check if parent has size and use that, or wait a bit more
        const parent = host.parentElement;
        if (parent && (parent.clientWidth > 0 || parent.clientHeight > 0)) {
          // Parent has size, host should get it soon - wait a bit more
          setTimeout(() => {
            if (host.clientWidth > 0 && host.clientHeight > 0) {
              console.log(`[showEmbeddedInspector] Host got size after extended wait: ${host.clientWidth}x${host.clientHeight}`);
            } else {
              console.warn('[showEmbeddedInspector] Host size timeout after polling, current size:', host.clientWidth, 'x', host.clientHeight);
            }
            resolve();
          }, 500);
        } else {
          console.warn('[showEmbeddedInspector] Host size timeout after polling, current size:', host.clientWidth, 'x', host.clientHeight);
          resolve();
        }
        return;
      }
    }, 100);
    
    // Also use ResizeObserver as backup
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => {
        if (!resolved && host.clientWidth > 0 && host.clientHeight > 0) {
          resolved = true;
          clearInterval(poll);
          ro!.disconnect();
          console.log(`[showEmbeddedInspector] Host got size via ResizeObserver: ${host.clientWidth}x${host.clientHeight}`);
          resolve();
        }
      });
      ro.observe(host);
    } catch (err) {
      console.warn('[showEmbeddedInspector] ResizeObserver not available, using polling only');
    }
  });

  adopt(host);

      // Immediately fix positioning after adoption to prevent initial offset
      const rootAfterAdopt = host.querySelector(Q) as HTMLElement | null;
      if (rootAfterAdopt) {
        rootAfterAdopt.style.setProperty('position', 'absolute', 'important');
        rootAfterAdopt.style.setProperty('top', '0', 'important');
        rootAfterAdopt.style.setProperty('left', '0', 'important');
        rootAfterAdopt.style.setProperty('transform', 'translate(0, 0)', 'important');
      }
      
      harden(host);
      
      // Immediate cleanup of any overlays
      setTimeout(() => {
        const rootForCleanup = host.querySelector(Q) as HTMLElement | null;
        if (rootForCleanup) {
          const treePanel = rootForCleanup.children[0] as HTMLElement;
          if (treePanel) {
            // Find and hide any absolutely positioned elements with "Add new" text that overlap the tree
            const allElements = rootForCleanup.querySelectorAll('*');
            allElements.forEach((elem) => {
              const el = elem as HTMLElement;
              const text = el.textContent || '';
              if (text.includes('Add new') && text.length < 200) {
                const styles = window.getComputedStyle(el);
                if ((styles.position === 'absolute' || styles.position === 'fixed') && 
                    parseInt(styles.zIndex) > 100) {
                  const rect = el.getBoundingClientRect();
                  const treeRect = treePanel.getBoundingClientRect();
                  const overlaps = !(rect.right < treeRect.left || rect.left > treeRect.right || 
                                    rect.bottom < treeRect.top + 100 || rect.top > treeRect.bottom);
                  if (overlaps) {
                    console.warn('[showEmbeddedInspector] Hiding initial overlay:', text.substring(0, 50));
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('visibility', 'hidden', 'important');
                    el.style.setProperty('opacity', '0', 'important');
                  }
                }
              }
            });
          }
        }
      }, 500);

      // Verify Inspector root was created (reuse root from earlier check)
      const rootForVerification = host.querySelector(Q) as HTMLElement | null;
  if (!rootForVerification) {
    console.warn('[showEmbeddedInspector] Inspector root element not found after show()');
    // Retry adoption after a delay
    setTimeout(() => {
      adopt(host);
      harden(host);
    }, 500);
  } else {
    console.log('[showEmbeddedInspector] Inspector root found, setting up observers');
    
    // Force visibility and size
    rootForVerification.style.setProperty('display', 'grid', 'important');
    rootForVerification.style.setProperty('visibility', 'visible', 'important');
    rootForVerification.style.setProperty('opacity', '1', 'important');
    rootForVerification.style.setProperty('width', '100%', 'important');
    rootForVerification.style.setProperty('height', '100%', 'important');
    rootForVerification.style.setProperty('min-width', '1px', 'important');
    rootForVerification.style.setProperty('min-height', '1px', 'important');
    
    // DEBUG: Check what's actually in the root
    setTimeout(() => {
      const computed = window.getComputedStyle(rootForVerification);
      const children = Array.from(rootForVerification.children);
      
      console.log('[showEmbeddedInspector] DEBUG - Root basic info:');
      console.log('  - Display:', computed.display);
      console.log('  - Visibility:', computed.visibility);
      console.log('  - Opacity:', computed.opacity);
      console.log('  - Size:', computed.width, 'x', computed.height);
      console.log('  - Position:', computed.position, computed.top, computed.left);
      console.log('  - Z-index:', computed.zIndex);
      console.log('  - Background:', computed.backgroundColor);
      console.log('  - Child count:', children.length);
      
      if (children.length > 0) {
        console.log('[showEmbeddedInspector] DEBUG - Children:');
        children.forEach((c, i) => {
          const child = c as HTMLElement;
          const childStyles = window.getComputedStyle(child);
          console.log(`  [${i}] ${c.tagName}`, {
            className: c.className,
            id: c.id,
            display: childStyles.display,
            visibility: childStyles.visibility,
            opacity: childStyles.opacity,
            width: childStyles.width,
            height: childStyles.height,
            position: childStyles.position,
            backgroundColor: childStyles.backgroundColor,
            zIndex: childStyles.zIndex,
            clientWidth: child.clientWidth,
            clientHeight: child.clientHeight,
          });
          
          // Log full child details
          console.log(`  [${i}] Full details:`, {
            tag: c.tagName,
            id: c.id,
            className: c.className,
            clientWidth: child.clientWidth,
            clientHeight: child.clientHeight,
            offsetWidth: child.offsetWidth,
            offsetHeight: child.offsetHeight,
            scrollWidth: child.scrollWidth,
            scrollHeight: child.scrollHeight,
            innerHTML_length: child.innerHTML.length,
            textContent_length: child.textContent?.length || 0,
            computed_display: childStyles.display,
            computed_width: childStyles.width,
            computed_height: childStyles.height,
            computed_position: childStyles.position,
            computed_top: childStyles.top,
            computed_left: childStyles.left,
            computed_background: childStyles.backgroundColor,
            computed_color: childStyles.color,
          });
          
          // Force child to fill if it's not
          if (child.clientWidth === 0 || child.clientHeight === 0) {
            console.warn(`[showEmbeddedInspector] Child [${i}] has zero size! Forcing...`);
            const rootWidth = rootForVerification.clientWidth;
            const rootHeight = rootForVerification.clientHeight;
            if (i === 0) {
              // First child (tree) - 450px width
              child.style.setProperty('width', '450px', 'important');
              child.style.setProperty('height', `${rootHeight}px`, 'important');
            } else {
              // Other children - fill remaining
              child.style.setProperty('width', `${rootWidth - 450}px`, 'important');
              child.style.setProperty('height', `${rootHeight}px`, 'important');
            }
            child.style.setProperty('display', 'block', 'important');
            child.style.setProperty('visibility', 'visible', 'important');
            child.style.setProperty('opacity', '1', 'important');
            child.style.setProperty('position', 'relative', 'important');
            child.style.setProperty('overflow', 'auto', 'important');
          }
        });
        
        // Force all children to be visible and fill
        children.forEach((c, idx) => {
          const child = c as HTMLElement;
          const rootWidth = rootForVerification.clientWidth;
          const rootHeight = rootForVerification.clientHeight;
          
          child.style.setProperty('display', 'block', 'important');
          child.style.setProperty('visibility', 'visible', 'important');
          child.style.setProperty('opacity', '1', 'important');
          child.style.setProperty('position', 'relative', 'important');
          child.style.setProperty('overflow', 'auto', 'important');
          
          // Force explicit sizes
          if (idx === 0) {
            // First child (tree) - 450px width
            child.style.setProperty('width', '450px', 'important');
            child.style.setProperty('height', `${rootHeight}px`, 'important');
            child.style.setProperty('min-width', '450px', 'important');
            child.style.setProperty('max-width', '450px', 'important');
            child.style.setProperty('grid-column', '1', 'important');
            // Force visible background for debugging
            child.style.setProperty('background-color', 'rgb(40, 40, 40)', 'important');
            child.style.setProperty('color', 'rgb(255, 255, 255)', 'important');
          } else {
            // Other children - fill remaining (properties panel)
            child.style.setProperty('width', `${rootWidth - 450}px`, 'important');
            child.style.setProperty('height', `${rootHeight}px`, 'important');
            child.style.setProperty('min-height', `${rootHeight}px`, 'important');
            child.style.setProperty('grid-column', '2', 'important');
            child.style.setProperty('background-color', 'rgb(45, 45, 45)', 'important');
            child.style.setProperty('color', 'rgb(255, 255, 255)', 'important');
            // CRITICAL: Force height even if content is empty
            if (child.clientHeight === 0) {
              child.style.setProperty('height', `${rootHeight}px`, 'important');
              child.style.setProperty('min-height', `${rootHeight}px`, 'important');
            }
          }
          
          // Log content check
          const hasContent = child.innerHTML.length > 0 || (child.textContent?.length || 0) > 0;
          if (!hasContent) {
            console.warn(`[showEmbeddedInspector] Child [${idx}] has NO CONTENT!`, {
              innerHTML_length: child.innerHTML.length,
              textContent_length: child.textContent?.length || 0,
            });
          } else {
            console.log(`[showEmbeddedInspector] Child [${idx}] has content:`, {
              innerHTML_length: child.innerHTML.length,
              textContent_length: child.textContent?.length || 0,
              firstChars: child.textContent?.substring(0, 100),
            });
          }
          
          // DON'T force visibility on ALL descendants - this causes tooltips/popups to appear
          // Only force visibility on elements that are part of the main structure (not absolutely positioned overlays)
          const allDescendants = child.querySelectorAll('*');
          let hiddenCount = 0;
          let overlayCount = 0;
          allDescendants.forEach((desc) => {
            const descEl = desc as HTMLElement;
            const descStyles = window.getComputedStyle(descEl);
            const position = descStyles.position;
            const zIndex = parseInt(descStyles.zIndex) || 0;
            const text = descEl.textContent || '';
            
            // Skip absolutely/fixed positioned elements with high z-index - these are likely overlays/tooltips
            if ((position === 'absolute' || position === 'fixed') && zIndex > 100) {
              // This is likely an overlay - hide it instead
              if (text.includes('Add new') || text.includes('Add point') || text.includes('Add stand')) {
                overlayCount++;
                descEl.style.setProperty('display', 'none', 'important');
                descEl.style.setProperty('visibility', 'hidden', 'important');
                descEl.style.setProperty('opacity', '0', 'important');
                return;
              }
            }
            
            // Only force visibility on non-overlay elements that are hidden
            if ((descStyles.display === 'none' || descStyles.visibility === 'hidden' || descStyles.opacity === '0') &&
                position !== 'absolute' && position !== 'fixed') {
              hiddenCount++;
              descEl.style.setProperty('display', descEl.tagName === 'TABLE' ? 'table' : 'block', 'important');
              descEl.style.setProperty('visibility', 'visible', 'important');
              descEl.style.setProperty('opacity', '1', 'important');
            }
          });
          if (hiddenCount > 0) {
            console.log(`[showEmbeddedInspector] Forced visibility on ${hiddenCount} hidden descendants in child [${idx}]`);
          }
          if (overlayCount > 0) {
            console.log(`[showEmbeddedInspector] Hid ${overlayCount} overlay elements in child [${idx}]`);
          }
        });
      } else {
        console.error('[showEmbeddedInspector] ❌ Root has NO CHILDREN - Inspector content not rendered!');
        console.log('[showEmbeddedInspector] Root innerHTML length:', rootForVerification.innerHTML.length);
        console.log('[showEmbeddedInspector] Root textContent length:', rootForVerification.textContent?.length || 0);
      }
      
      // Check if root is actually visible
      if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
        console.error('[showEmbeddedInspector] ❌ Root is HIDDEN!');
      } else {
        console.log('[showEmbeddedInspector] ✅ Root is visible');
      }
      
      // Check if root is correctly positioned relative to host (not viewport - we don't care about viewport for embedded mode)
      const rect = rootForVerification.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      const rootInHost = host.contains(rootForVerification);
      const positionOffset = Math.abs(rect.top - hostRect.top) + Math.abs(rect.left - hostRect.left);
      const isCorrectlyPositioned = rootInHost && positionOffset < 5; // Allow 5px tolerance for floating-point precision
      
      console.log('[showEmbeddedInspector] Position check:', {
        rootRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        hostRect: { top: hostRect.top, left: hostRect.left, width: hostRect.width, height: hostRect.height },
        rootInHost,
        positionOffset,
        isCorrectlyPositioned,
      });
      
      // Only fix positioning if root is NOT correctly positioned relative to host
      if (!isCorrectlyPositioned) {
        console.warn('[showEmbeddedInspector] ⚠️ Root is not correctly positioned relative to host!');
        
        // Force root to be positioned relative to host
        if (!host.contains(rootForVerification)) {
          console.error('[showEmbeddedInspector] Root is NOT in host! Re-adopting...');
          adopt(host);
        }
        
        // Reset positioning to be relative to host
        rootForVerification.style.setProperty('position', 'absolute', 'important');
        rootForVerification.style.setProperty('top', '0', 'important');
        rootForVerification.style.setProperty('left', '0', 'important');
        rootForVerification.style.setProperty('right', 'auto', 'important');
        rootForVerification.style.setProperty('bottom', 'auto', 'important');
        rootForVerification.style.setProperty('margin', '0', 'important');
        rootForVerification.style.setProperty('padding', '0', 'important');
      } else {
        console.log('[showEmbeddedInspector] ✅ Root is correctly positioned relative to host');
      }
      
      // Force a reflow/repaint to ensure rendering
      rootForVerification.offsetHeight; // Trigger reflow
      rootForVerification.style.setProperty('transform', 'translateZ(0)', 'important'); // Force GPU acceleration
    }, 1000);
  }

  // Track processed elements to avoid infinite loops
  const processedElements = new WeakSet<HTMLElement>();
  
  // Function to clean up overlaying elements
  const cleanupOverlays = () => {
    const root = host.querySelector(Q) as HTMLElement | null;
    if (!root) return;
    
    const treePanel = root.children[0] as HTMLElement;
    if (!treePanel) return;
    
    // Find all elements with text "Add new" that might be overlaying
    const allElements = root.querySelectorAll('*');
    let hiddenCount = 0;
    allElements.forEach((elem) => {
      const el = elem as HTMLElement;
      
      // Skip if already processed and hidden
      if (processedElements.has(el)) {
        const styles = window.getComputedStyle(el);
        if (styles.display === 'none' || styles.visibility === 'hidden') {
          return; // Already hidden, skip
        }
      }
      
      const text = el.textContent || '';
      
      // Check for overlay text patterns (corrupted menu items)
      const isOverlayText = text.includes('Add new') || text.includes('Add point') || 
                           text.includes('Add stand') || text.includes('CPU') || 
                           text.includes('Pipelile') || text.includes('svite') ||
                           text.includes('Defaun') || text.includes('Rendermq') || 
                           text.includes('DarticE') || text.includes('Frmle');
      
      if (isOverlayText && text.length < 200) {
        const styles = window.getComputedStyle(el);
        const position = styles.position;
        const zIndex = parseInt(styles.zIndex) || 0;
        
        // Skip if already hidden
        if (styles.display === 'none' || styles.visibility === 'hidden') {
          processedElements.add(el);
          return;
        }
        
        // If it's absolutely/fixed positioned, it's definitely an overlay - hide it
        if (position === 'absolute' || position === 'fixed') {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          processedElements.add(el);
          hiddenCount++;
          return;
        }
        
        // Also check if it has high z-index
        if (zIndex > 100) {
          const rect = el.getBoundingClientRect();
          const treeRect = treePanel.getBoundingClientRect();
          
          // If it overlaps with the tree panel at the top, hide it
          const overlaps = !(rect.right < treeRect.left || rect.left > treeRect.right || 
                            rect.bottom < treeRect.top + 100 || rect.top > treeRect.bottom);
          
          if (overlaps) {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            processedElements.add(el);
            hiddenCount++;
          }
        }
      }
    });
    
    // Only log if we actually hid something new
    if (hiddenCount > 0) {
      console.log(`[cleanupOverlays] Hid ${hiddenCount} overlay element(s)`);
    }
  };

  // Debounce cleanup to avoid infinite loops
  let cleanupTimeout: ReturnType<typeof setTimeout> | null = null;
  const debouncedCleanup = () => {
    if (cleanupTimeout) clearTimeout(cleanupTimeout);
    cleanupTimeout = setTimeout(cleanupOverlays, 500); // 500ms debounce
  };
  
  // Run cleanup periodically and on mutations (with debouncing)
  const mutationObserver = new MutationObserver(() => {
    adopt(host);
    debouncedCleanup();
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
  
  // Also observe the Inspector root for changes
  const rootForObserver = host.querySelector(Q) as HTMLElement | null;
  if (rootForObserver) {
    mutationObserver.observe(rootForObserver, { childList: true, subtree: true, attributes: true });
  }

  // ResizeObserver to handle host size changes and re-apply styles
  const resizeObserver = new ResizeObserver(() => {
    // Only harden if host has size
    if (host.clientWidth > 0 && host.clientHeight > 0) {
      harden(host);
      debouncedCleanup();
    }
  });
  resizeObserver.observe(host);
  
  // Also observe parent in case host size comes from parent
  const hostParent = host.parentElement;
  if (hostParent) {
    resizeObserver.observe(hostParent);
  }
  
  // Run cleanup periodically (less frequently to avoid spam)
  const cleanupInterval = setInterval(cleanupOverlays, 5000); // Every 5 seconds instead of 1
  
  // Listen for scene changes to refresh Inspector
  // NOTE: Embedded mode does NOT auto-refresh by default (confirmed via Babylon.js docs/forum)
  // This is a known limitation - embedded mode doesn't subscribe to scene observables like overlay mode
  // We must manually refresh when objects are added. Official methods: debugLayer.refresh() or setAsActiveScene()
  if (args.scene) {
    // Function to refresh the Inspector tree view
    const refreshInspectorTree = () => {
      const root = host.querySelector(Q) as HTMLElement | null;
      if (!root || !args.scene!.debugLayer.isVisible()) {
        console.warn('[refreshInspectorTree] Inspector root not found or not visible');
        return;
      }

      console.log('[refreshInspectorTree] Attempting to refresh Inspector tree...');

      // Method 1: Use the official debugLayer.refresh() method (recommended by Babylon.js docs)
      // This is the proper way to refresh the Inspector in embedded mode
      try {
        const debugLayer = args.scene!.debugLayer;
        if (debugLayer && typeof (debugLayer as any).refresh === 'function') {
          (debugLayer as any).refresh();
          console.log('[refreshInspectorTree] ✅ Called debugLayer.refresh() (official method)');
          return;
        }
      } catch (err) {
        console.warn('[refreshInspectorTree] debugLayer.refresh() not available:', err);
      }

      // Method 2: Try setAsActiveScene() - another official method mentioned in docs
      try {
        const debugLayer = args.scene!.debugLayer;
        if (debugLayer && typeof (debugLayer as any).setAsActiveScene === 'function') {
          (debugLayer as any).setAsActiveScene();
          console.log('[refreshInspectorTree] ✅ Called debugLayer.setAsActiveScene()');
          return;
        }
      } catch (err) {
        console.warn('[refreshInspectorTree] debugLayer.setAsActiveScene() not available:', err);
      }

      // Method 3: Try to access Inspector's internal API (fallback)
      try {
        const winB = (window as any).BABYLON;
        const debugLayer = args.scene!.debugLayer as any;
        
        // Try to get Inspector instance from various possible locations
        let inspector = debugLayer._inspector;
        if (!inspector && winB?.Inspector) {
          inspector = (args.scene as any)._babylonjsInspector;
        }
        
        if (inspector) {
          console.log('[refreshInspectorTree] Found Inspector instance, trying internal methods...');
          
          if (typeof inspector.refresh === 'function') {
            inspector.refresh();
            console.log('[refreshInspectorTree] ✅ Called Inspector.refresh()');
            return;
          }
          
          if (inspector._treeView && typeof inspector._treeView.refresh === 'function') {
            inspector._treeView.refresh();
            console.log('[refreshInspectorTree] ✅ Called Inspector._treeView.refresh()');
            return;
          }
        }
      } catch (err) {
        console.warn('[refreshInspectorTree] Error accessing Inspector internal API:', err);
      }

      // Method 2: Find and click the Scene node to force refresh
      const treePanel = root.querySelector('#tree') as HTMLElement | null;
      if (treePanel) {
        // Try multiple selectors to find the Scene node
        let sceneNode = treePanel.querySelector('[data-name="Scene"]') as HTMLElement | null;
        if (!sceneNode) {
          // Try finding by text content - be more specific
          const allNodes = treePanel.querySelectorAll('div, span, li, a');
          for (const node of Array.from(allNodes)) {
            const text = node.textContent?.trim() || '';
            if (text === 'Scene' || (text.includes('Scene') && text.length < 20)) {
              // Check if it's clickable (has click handler or is a button/link)
              sceneNode = node as HTMLElement;
              console.log('[refreshInspectorTree] Found Scene node by text:', text);
              break;
            }
          }
        }
        
        if (sceneNode) {
          // Try clicking multiple times to ensure it expands
          const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
          sceneNode.click(); // Use .click() instead of dispatchEvent for better compatibility
          setTimeout(() => {
            sceneNode!.click();
            console.log('[refreshInspectorTree] ✅ Triggered Scene node click to refresh');
          }, 100);
          setTimeout(() => {
            sceneNode!.click();
          }, 300);
        } else {
          console.warn('[refreshInspectorTree] Could not find Scene node in tree');
        }
      } else {
        console.warn('[refreshInspectorTree] Tree panel (#tree) not found');
      }

      // Method 3: Try to find and click the refresh button if it exists
      const refreshButton = root.querySelector('[title*="refresh" i], [aria-label*="refresh" i], .refresh-button, button[class*="refresh"], [class*="refresh-icon"]') as HTMLElement | null;
      if (refreshButton) {
        refreshButton.click();
        console.log('[refreshInspectorTree] ✅ Clicked refresh button');
        return;
      }

      // Method 4: Last resort - Force rebuild by hiding and re-showing the Inspector
      // Only do this if we haven't done it recently (prevent flickering)
      const lastRebuild = (host as any)._lastInspectorRebuild || 0;
      const now = Date.now();
      if (now - lastRebuild > 5000) { // Only rebuild if last rebuild was > 5 seconds ago
        try {
          console.log('[refreshInspectorTree] Last resort: Attempting to force rebuild by hiding/re-showing...');
          (host as any)._lastInspectorRebuild = now;
          const debugLayer = args.scene!.debugLayer;
          
          // Hide and re-show to force rebuild
          debugLayer.hide().then(() => {
            setTimeout(async () => {
              try {
                await debugLayer.show({
                  embedMode: true,
                  overlay: false,
                  enablePopup: false,
                  rootElement: host,
                  parentElement: host,
                  globalRoot: host
                } as any);
                
                // Re-apply styles after re-show
                setTimeout(() => {
                  adopt(host);
                  harden(host);
                  console.log('[refreshInspectorTree] ✅ Inspector rebuilt by hide/show');
                }, 500);
              } catch (err) {
                console.error('[refreshInspectorTree] Error re-showing Inspector:', err);
              }
            }, 100);
          }).catch((err: any) => {
            console.warn('[refreshInspectorTree] Error hiding Inspector for rebuild:', err);
          });
        } catch (err) {
          console.warn('[refreshInspectorTree] Could not force rebuild:', err);
        }
      } else {
        console.log('[refreshInspectorTree] Skipping rebuild (too recent)');
      }

      console.warn('[refreshInspectorTree] ⚠️ All refresh methods attempted - Inspector may not update automatically');
    };

    // Also ensure the "Nodes" section is expanded when objects are added
    // This helps visibility - if Nodes is collapsed, new objects won't be visible
    const ensureNodesExpanded = () => {
      const root = host.querySelector(Q) as HTMLElement | null;
      if (!root) return;
      
      const treePanel = root.querySelector('#tree') as HTMLElement | null;
      if (!treePanel) return;
      
      // Find the "Nodes" expandable item
      const allNodes = treePanel.querySelectorAll('div, span, li');
      for (const node of Array.from(allNodes)) {
        const text = node.textContent?.trim() || '';
        if (text === 'Nodes' || text.startsWith('Nodes')) {
          // Check if it's collapsed (has a + icon or collapsed class)
          const isCollapsed = node.querySelector('.fa-plus, .expand-icon, [class*="collapsed"]') !== null;
          if (isCollapsed) {
            // Click to expand
            (node as HTMLElement).click();
            console.log('[InspectorService] Expanded Nodes section');
          }
          break;
        }
      }
    };
    
    // Enhanced refresh that also ensures Nodes is expanded
    const enhancedRefresh = () => {
      ensureNodesExpanded();
      refreshInspectorTree();
    };
    
    // Enhanced debounced refresh
    const enhancedDebouncedRefresh = () => {
      if ((host as any)._refreshTimeout) {
        clearTimeout((host as any)._refreshTimeout);
      }
      (host as any)._refreshTimeout = setTimeout(() => {
        enhancedRefresh();
      }, 300);
    };
    
    // Listen for new mesh additions
    const onNewMeshAdded = () => {
      console.log('[InspectorService] New mesh added, refreshing Inspector tree...');
      enhancedDebouncedRefresh();
    };

    // Listen for new transform node additions (boxes might be added as TransformNodes)
    const onNewTransformNodeAdded = () => {
      console.log('[InspectorService] New transform node added, refreshing Inspector tree...');
      enhancedDebouncedRefresh();
    };

    // Listen for both observables
    args.scene.onNewMeshAddedObservable.add(onNewMeshAdded);
    args.scene.onNewTransformNodeAddedObservable.add(onNewTransformNodeAdded);
    
    // Expose refresh function on host element for manual triggering
    (host as any)._inspectorRefresh = () => {
      console.log('[InspectorService] Manual refresh triggered');
      enhancedDebouncedRefresh();
    };
    
    // Listen for custom refresh events (from editor store or other sources)
    const onRefreshRequested = () => {
      console.log('[InspectorService] Refresh requested via custom event');
      enhancedDebouncedRefresh();
    };
    window.addEventListener('inspector-refresh-requested', onRefreshRequested);
    
    // Initial refresh to show existing objects in the scene
    // Wait a bit for the Inspector to fully render before refreshing
    setTimeout(() => {
      console.log('[InspectorService] Performing initial Inspector refresh for existing scene objects...');
      enhancedRefresh();
    }, 2000); // 2 seconds after mount to ensure Inspector is fully rendered
    
    // Store cleanup function for potential future use
    (host as any)._inspectorCleanup = () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      clearInterval(cleanupInterval);
      if (cleanupTimeout) clearTimeout(cleanupTimeout);
      if ((host as any)._refreshTimeout) clearTimeout((host as any)._refreshTimeout);
      window.removeEventListener('inspector-refresh-requested', onRefreshRequested);
      delete (host as any)._inspectorRefresh;
      if (args.scene) {
        args.scene.onNewMeshAddedObservable.removeCallback(onNewMeshAdded);
        args.scene.onNewTransformNodeAddedObservable.removeCallback(onNewTransformNodeAdded);
      }
    };
  } else {
    // Store cleanup function for potential future use
    (host as any)._inspectorCleanup = () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      clearInterval(cleanupInterval);
      if (cleanupTimeout) clearTimeout(cleanupTimeout);
      if ((host as any)._refreshTimeout) clearTimeout((host as any)._refreshTimeout);
    };
  }
}

function adopt(host: HTMLElement) {
  let root = host.querySelector(Q) || document.querySelector(Q);
  if (!root) {
    // Only log if we're actively looking for it (not on every mutation)
    return;
  }
  if (!host.contains(root)) {
    console.log('[adopt] Root not in host, moving to host...');
    host.appendChild(root);
    console.log('[adopt] Root moved to host');
    // Immediately fix positioning after moving
    (root as HTMLElement).style.setProperty('position', 'absolute', 'important');
    (root as HTMLElement).style.setProperty('top', '0', 'important');
    (root as HTMLElement).style.setProperty('left', '0', 'important');
  }
  // Don't log when root is already in host - reduces spam
}

function harden(host: HTMLElement) {
  const root = host.querySelector(Q) as HTMLElement | null;
  if (!root) {
    console.warn('[harden] Inspector root not found in host');
    return;
  }

  // Force host styles with !important
  host.style.setProperty('position', 'relative', 'important');
  host.style.setProperty('flex', '1 1 auto', 'important');
  host.style.setProperty('width', '100%', 'important');
  host.style.setProperty('height', '100%', 'important');
  host.style.setProperty('min-width', '0', 'important');
  host.style.setProperty('min-height', '0', 'important');
  host.style.setProperty('overflow', 'hidden', 'important');
  host.style.setProperty('display', 'block', 'important'); // Changed from flex to block

  // CRITICAL: Force root to fill host using explicit pixel values
  const hostWidth = host.clientWidth || host.offsetWidth;
  const hostHeight = host.clientHeight || host.offsetHeight;
  
  // CRITICAL: Ensure host has position: relative FIRST (before positioning root)
  // This creates the positioning context for the absolutely positioned root
  host.style.setProperty('position', 'relative', 'important');
  host.style.setProperty('z-index', '1', 'important');
  
  // CRITICAL: Set position FIRST before any other styles to prevent offset
  root.style.setProperty('position', 'absolute', 'important');
  root.style.setProperty('top', '0px', 'important');
  root.style.setProperty('left', '0px', 'important');
  root.style.setProperty('transform', 'translate(0, 0)', 'important'); // Explicit translate to prevent offset
  
  // Force a reflow to apply position immediately
  root.offsetHeight;
  
  // Now set other styles
  root.style.setProperty('right', 'auto', 'important'); // Don't use right/bottom with explicit width/height
  root.style.setProperty('bottom', 'auto', 'important');
  root.style.setProperty('width', `${hostWidth}px`, 'important');
  root.style.setProperty('height', `${hostHeight}px`, 'important');
  root.style.setProperty('min-width', `${hostWidth}px`, 'important');
  root.style.setProperty('min-height', `${hostHeight}px`, 'important');
  root.style.setProperty('max-width', 'none', 'important');
  root.style.setProperty('max-height', 'none', 'important');
  root.style.setProperty('margin', '0', 'important');
  root.style.setProperty('padding', '0', 'important');
  root.style.setProperty('display', 'grid', 'important');
  root.style.setProperty('visibility', 'visible', 'important');
  root.style.setProperty('opacity', '1', 'important');
  root.style.setProperty('z-index', '9999', 'important'); // Very high z-index to ensure it's on top
  root.style.setProperty('grid-template-columns', '450px minmax(0, 1fr)', 'important');
  root.style.setProperty('box-sizing', 'border-box', 'important');
  root.style.setProperty('pointer-events', 'auto', 'important');
  // Force background to ensure it's visible (will be overridden by Inspector's own styles, but ensures base visibility)
  if (!root.style.backgroundColor || root.style.backgroundColor === 'transparent' || root.style.backgroundColor === 'rgba(0, 0, 0, 0)') {
    root.style.setProperty('background-color', 'rgb(51, 51, 51)', 'important');
  }
  
  // Verify positioning after applying styles
  const rootRect = root.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const offsetTop = rootRect.top - hostRect.top;
  const offsetLeft = rootRect.left - hostRect.left;
  
  if (Math.abs(offsetTop) > 1 || Math.abs(offsetLeft) > 1) {
    // CRITICAL: If offset equals host height, root is positioned at bottom instead of top
    // This is the main issue - root is being positioned relative to bottom of host
    const isBottomPositioned = Math.abs(Math.abs(offsetTop) - hostHeight) < 5;
    
    if (isBottomPositioned) {
      // Root is at bottom - this is a known issue we can fix, so don't warn
      // Just fix it silently
      root.remove();
      host.appendChild(root);
      // Immediately set position to top
      root.style.setProperty('position', 'absolute', 'important');
      root.style.setProperty('top', '0px', 'important');
      root.style.setProperty('left', '0px', 'important');
      root.style.setProperty('transform', 'translate(0, 0)', 'important');
      root.offsetHeight; // Force reflow
    } else {
      // Only log if offset is significant (more than 10px) and not the bottom-positioning case
      if (Math.abs(offsetTop) > 10 || Math.abs(offsetLeft) > 10) {
        console.warn('[harden] Root is offset from host!', { offsetTop, offsetLeft, rootTop: rootRect.top, hostTop: hostRect.top });
      }
      // Normal offset - standard fix
      const parent = root.parentElement;
      if (parent && parent !== host) {
        root.remove();
        host.appendChild(root);
      } else if (parent === host && Math.abs(offsetTop) > 10) {
        root.remove();
        host.appendChild(root);
      }
      
      // Force reset position immediately
      root.style.setProperty('position', 'absolute', 'important');
      root.style.setProperty('top', '0px', 'important');
      root.style.setProperty('left', '0px', 'important');
      root.style.setProperty('right', 'auto', 'important');
      root.style.setProperty('bottom', 'auto', 'important');
      root.style.setProperty('margin', '0', 'important');
      root.style.setProperty('padding', '0', 'important');
      root.style.setProperty('transform', 'translate(0, 0)', 'important');
      root.offsetHeight; // Force reflow
    }
    
    // Verify and fix again in next frame if still offset
    requestAnimationFrame(() => {
      const newRootRect = root.getBoundingClientRect();
      const newHostRect = host.getBoundingClientRect();
      const newOffsetTop = newRootRect.top - newHostRect.top;
      const newOffsetLeft = newRootRect.left - newHostRect.left;
      
      if (Math.abs(newOffsetTop) > 1 || Math.abs(newOffsetLeft) > 1) {
        // Still offset - one more aggressive fix
        root.style.setProperty('top', '0px', 'important');
        root.style.setProperty('left', '0px', 'important');
        root.style.setProperty('transform', 'translate(0, 0)', 'important');
        root.style.setProperty('margin-top', '0px', 'important');
        root.style.setProperty('margin-left', '0px', 'important');
        root.offsetHeight; // Force another reflow
      }
    });
  }

  // Force all direct children to fill and be visible
  const children = Array.from(root.children);
  
  // If there's only one child (tree), the properties panel might not be created yet
  // Wait a bit and check again, or ensure the grid creates space for it
  if (children.length === 1) {
    // Properties panel not created yet - ensure grid still reserves space for it
    root.style.setProperty('grid-template-columns', '450px minmax(0, 1fr)', 'important');
    
    // Try to find or create the properties panel
    setTimeout(() => {
      const updatedChildren = Array.from(root.children);
      if (updatedChildren.length === 1) {
        // Still only one child - properties panel might be hidden or not created
        // Check if there's a properties panel that's just hidden
        const hiddenProperties = root.querySelectorAll('div:not(#tree)');
        if (hiddenProperties.length === 0) {
          // No properties panel at all - create a placeholder
          const treePanel = updatedChildren[0] as HTMLElement;
          if (treePanel) {
            treePanel.style.setProperty('grid-column', '1', 'important');
            // Create a placeholder for the second column if it doesn't exist
            const existingSecond = root.querySelector('[data-inspector-properties]');
            if (!existingSecond) {
              const placeholder = document.createElement('div');
              placeholder.setAttribute('data-inspector-properties', 'true');
              placeholder.style.setProperty('grid-column', '2', 'important');
              placeholder.style.setProperty('width', '100%', 'important');
              placeholder.style.setProperty('height', '100%', 'important');
              placeholder.style.setProperty('min-height', `${root.clientHeight}px`, 'important');
              placeholder.style.setProperty('background-color', 'rgb(45, 45, 45)', 'important');
              root.appendChild(placeholder);
            }
          }
        }
      }
    }, 500);
  }
  
  children.forEach((child, idx) => {
    const el = child as HTMLElement;
    el.style.setProperty('width', '100%', 'important');
    el.style.setProperty('height', '100%', 'important');
    el.style.setProperty('min-width', '0', 'important');
    el.style.setProperty('min-height', '0', 'important');
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('opacity', '1', 'important');
    el.style.setProperty('position', 'relative', 'important');
    el.style.setProperty('overflow', 'auto', 'important');
    
        // If it's the first child (tree), ensure it has proper width for grid column
        if (idx === 0) {
          el.style.setProperty('grid-column', '1', 'important');
          el.style.setProperty('width', '450px', 'important');
          el.style.setProperty('min-width', '450px', 'important');
          el.style.setProperty('max-width', '450px', 'important');
    } else {
      el.style.setProperty('grid-column', '2', 'important');
      el.style.setProperty('flex', '1 1 auto', 'important');
      el.style.setProperty('max-width', 'none', 'important'); // Allow second column to expand fully
      el.style.setProperty('width', '100%', 'important'); // Ensure it fills available space
      // CRITICAL: Force height to match root height
      const rootHeight = root.clientHeight || root.offsetHeight;
      if (rootHeight > 0) {
        el.style.setProperty('height', `${rootHeight}px`, 'important');
        el.style.setProperty('min-height', `${rootHeight}px`, 'important');
      }
      // If still zero height, force it
      if (el.clientHeight === 0 && rootHeight > 0) {
        el.style.setProperty('height', `${rootHeight}px`, 'important');
        el.style.setProperty('min-height', `${rootHeight}px`, 'important');
        el.style.setProperty('display', 'block', 'important');
      }
    }
  });

  // Neutralize split calc(50%)
  root.querySelectorAll('*[style*="calc(50%"]').forEach(n => {
    (n as HTMLElement).style.setProperty('height', '100%', 'important');
    (n as HTMLElement).style.setProperty('min-height', '0', 'important');
  });
  
  // CRITICAL: Find and fix any overlaying elements that might be covering the tree
  // Also remove max-width constraints to allow full width
  // Look for absolutely positioned elements, tooltips, popups, or floating menus
  const allElements = root.querySelectorAll('*');
  let overlayCount = 0;
  allElements.forEach((elem) => {
    const el = elem as HTMLElement;
    const styles = window.getComputedStyle(el);
    const position = styles.position;
    const zIndex = parseInt(styles.zIndex) || 0;
    const maxWidth = styles.maxWidth;
    
    // Remove max-width constraints (except for tree panel which should stay at 450px)
    const treePanel = root.children[0] as HTMLElement;
    if (!treePanel || !treePanel.contains(el)) {
      // Not in tree panel, so remove max-width constraints
      if (maxWidth && maxWidth !== 'none' && maxWidth !== '0px') {
        el.style.setProperty('max-width', 'none', 'important');
      }
    }
    
    // Check if this element is absolutely or fixed positioned and might be overlaying
    if ((position === 'absolute' || position === 'fixed') && zIndex > 100) {
      // Check if it's inside the tree panel (first child)
      const treePanel = root.children[0] as HTMLElement;
      if (treePanel && treePanel.contains(el)) {
        // This is an overlay inside the tree - check if it's covering content
        const rect = el.getBoundingClientRect();
        const treeRect = treePanel.getBoundingClientRect();
        
        // If overlay is positioned at top-left of tree and has text content, it might be a stuck tooltip/popup
        if (rect.top <= treeRect.top + 50 && rect.left <= treeRect.left + 50) {
          const hasText = el.textContent && el.textContent.trim().length > 0;
          const isSmall = rect.width < 500 && rect.height < 100;
          
          if (hasText && isSmall) {
            // This looks like a tooltip/popup that's stuck - hide it or move it
            console.warn('[harden] Found overlaying element covering tree:', {
              tag: el.tagName,
              className: el.className,
              id: el.id,
              text: el.textContent?.substring(0, 50),
              position,
              zIndex,
              rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
            });
            
            // Hide it or move it out of the way
            el.style.setProperty('display', 'none', 'important');
            overlayCount++;
          }
        }
      }
    }
    
    // Also check for elements with very high z-index that might be overlays
    if (zIndex > 10000 && position !== 'static') {
      const rect = el.getBoundingClientRect();
      const treePanel = root.children[0] as HTMLElement;
      if (treePanel) {
        const treeRect = treePanel.getBoundingClientRect();
        // Check if this element overlaps with the tree panel
        const overlaps = !(rect.right < treeRect.left || rect.left > treeRect.right || 
                          rect.bottom < treeRect.top || rect.top > treeRect.bottom);
        
        const text = el.textContent || '';
        if (overlaps && (text.includes('Add new') || text.includes('Add point') || text.includes('Add stand') || 
            text.includes('CPU') || text.includes('Pipelile') || text.includes('svite'))) {
          console.warn('[harden] Found high z-index element overlapping tree:', {
            tag: el.tagName,
            className: el.className,
            id: el.id,
            text: text.substring(0, 50),
            zIndex
          });
          
          // Hide it completely
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          overlayCount++;
        }
      }
    }
    
    // Also check for any element with "Add" text that's absolutely positioned - these are likely tooltips
    const text = el.textContent || '';
    if ((position === 'absolute' || position === 'fixed') && 
        (text.includes('Add new') || text.includes('Add point') || text.includes('Add stand') ||
         text.includes('CPU') || text.includes('Pipelile') || text.includes('svite') ||
         text.includes('Defaun') || text.includes('Rendermq') || text.includes('DarticE'))) {
      const treePanel = root.children[0] as HTMLElement;
      if (treePanel && treePanel.contains(el)) {
        // Don't log - just hide it silently
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        overlayCount++;
      }
    }
  });
  
  // Ensure tree panel has proper z-index to be above any overlays
  const treePanel = root.children[0] as HTMLElement;
  if (treePanel) {
    treePanel.style.setProperty('z-index', '10', 'important');
    treePanel.style.setProperty('position', 'relative', 'important');
  }
  
  if (overlayCount > 0) {
    console.log(`[harden] Fixed ${overlayCount} overlaying elements`);
  }
  
  console.log('[harden] Applied styles - host:', hostWidth, 'x', hostHeight, 'root:', root.clientWidth, 'x', root.clientHeight);
}

