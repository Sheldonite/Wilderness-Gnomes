import Phaser from 'phaser';
import { marketItemPreview } from '../../market/MarketItemPreview';
import { WEAPONS, type WeaponDefinition } from '../../config/weapons';
import { CosmeticGlow } from '../../market/CosmeticGlow';
import {
  COSMETIC_SLOTS,
  COSMETIC_SLOT_LABELS,
  MARKET_ITEMS,
  MARKET_VENDORS,
  getCosmeticSlot,
  marketItemBenefit,
  marketItemCurrency,
  marketItemPrice,
  type CosmeticId,
  type CosmeticSlot,
  type MarketItemId,
  type MarketVendorId
} from '../../config/marketItems';
import squareUrl from '../../../assets/storybook/newnan-market-square.png';
import { getPlayerCharacter, type PlayerCharacterDefinition } from '../../config/playerCharacters';
import { MarketProgress, marketProgress, type AnyWeaponId } from '../../core/MarketProgress';
import { audioSystem } from '../../systems/AudioSystem';
import type { Vector2Like } from '../../core/types';
import { MarketWorld } from '../../market/MarketWorld';
import { marketItemIcon } from '../../ui/marketIcons';
import { icon } from '../../ui/icons';

const WIDTH = 1536, HEIGHT = 1024;

const WEAPON_BY_MARKET_ITEM: Partial<Record<MarketItemId, AnyWeaponId>> = {
  'unlock-crossbow': 'crossbow',
  'unlock-boomerang': 'boomerang',
  'unlock-lantern': 'lantern'
};

const FALLBACK_WEAPON_NAMES: Record<AnyWeaponId, string> = {
  spell: 'Spell Charm',
  crossbow: 'Heartwood Crossbow',
  boomerang: 'Timber Boomerang',
  lantern: "Will-o'-Wisp Lantern"
};

function weaponLabel(id: AnyWeaponId): string {
  const weapon = (WEAPONS as Record<string, WeaponDefinition | undefined>)[id];
  return weapon?.name ?? FALLBACK_WEAPON_NAMES[id] ?? id;
}

/** A separate peaceful scene: no combat systems, spawners, XP or run clock. */
export class MarketScene extends Phaser.Scene {
  private world!: MarketWorld;
  private cosmetic!: CosmeticGlow;
  private player!: Phaser.GameObjects.Sprite;
  private root!: HTMLElement;
  private progress!: MarketProgress;
  private character!: PlayerCharacterDefinition;
  private weaponId: AnyWeaponId = 'spell';
  private keys!: Record<'w'|'a'|'s'|'d'|'up'|'down'|'left'|'right', Phaser.Input.Keyboard.Key>;
  private path: Vector2Like[] = [];
  private visiting?: MarketVendorId;
  private shop?: MarketVendorId;
  private nearestVendor?: MarketVendorId;
  private preview = false;
  private zoomed = true;
  private leaving = false;
  private facing: Vector2Like = { x: 0, y: 1 };
  private status = '';
  private destination!: Phaser.GameObjects.Graphics;
  private readonly onResize = () => this.resize();
  private readonly onKey = (event: KeyboardEvent) => {
    if (this.shop) {
      if (event.key === 'Escape') { event.preventDefault(); audioSystem.play('ui-click'); this.closeShop(); }
      if (event.key === 'Tab') {
        const buttons = [...this.root.querySelectorAll<HTMLButtonElement>('.market-shop button:not(:disabled)')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      return;
    }
    if (event.key.toLowerCase() === 'e' && this.nearestVendor) { event.preventDefault(); audioSystem.play('ui-click'); this.openShop(this.nearestVendor); }
    if (event.key === 'Escape') { audioSystem.play('ui-click'); this.returnToTitle(); }
  };

  constructor() { super('MarketScene'); }

  preload(): void {
    if (!this.textures.exists('newnan-market-square')) this.load.image('newnan-market-square', squareUrl);
  }

  create(data: { characterId?: string; weaponId?: AnyWeaponId; review?: boolean; vendorId?: MarketVendorId } = {}): void {
    this.path = []; this.visiting = undefined; this.shop = undefined; this.nearestVendor = undefined;
    this.facing = { x: 0, y: 1 };
    this.status = ''; this.zoomed = true; this.leaving = false;
    audioSystem.attachScene(this);
    audioSystem.setMusicMode('market');
    this.preview = import.meta.env.DEV && Boolean(data.review);
    this.progress = this.preview ? new MarketProgress(null) : marketProgress;
    if (this.preview) {
      this.progress.settleRun('market-preview-purse', 90);
      for (let i = 0; i < 6; i++) this.progress.collectRock(`market-preview-rock-${i}`);
    }
    this.progress.refresh();
    this.character = getPlayerCharacter(data.characterId);
    this.weaponId = this.preview ? data.weaponId ?? 'spell' : this.progress.equippedWeapon;
    this.anims.resumeAll();
    document.getElementById('game-root')?.classList.remove('in-run');
    this.cameras.main.setBackgroundColor('#223b31');
    this.add.image(WIDTH / 2, HEIGHT / 2, 'newnan-market-square').setDisplaySize(WIDTH, HEIGHT).setDepth(-100);
    this.world = new MarketWorld(this); this.world.create();
    this.player = this.add.sprite(768, 810, this.character.textureKey).setScale(this.character.scale).setOrigin(.5, this.character.footOriginY ?? 1);
    this.player.play(this.character.idleAnimation.key);
    this.cosmetic = new CosmeticGlow(this);
    this.destination = this.add.graphics().setDepth(10);
    this.keys = { w: this.input.keyboard!.addKey('W'), a: this.input.keyboard!.addKey('A'), s: this.input.keyboard!.addKey('S'), d: this.input.keyboard!.addKey('D'),
      up: this.input.keyboard!.addKey('UP'), down: this.input.keyboard!.addKey('DOWN'), left: this.input.keyboard!.addKey('LEFT'), right: this.input.keyboard!.addKey('RIGHT') };
    this.root = document.getElementById('ui-root')!;
    this.root.classList.remove('run-frozen', 'low-health');
    this.root.innerHTML = `<div class="market-ui">
      <header class="market-header">
        <button class="market-back" aria-label="Return to title">${icon('arrow')}</button>
        <div><span class="market-eyebrow">NEWNAN, GEORGIA · THE TOWN SQUARE</span><h1>Market Day</h1></div>
        <span class="market-peace">${icon('leaf')} A little peace between adventures</span>
        <div class="market-balances">
          <div class="market-purse" aria-label="Gold balance">${icon('gold')}<strong data-gold>${this.progress.profile.gold}</strong><span>GOLD</span></div>
          <div class="market-purse market-purse-rocks" aria-label="Rare rocks balance">${icon('rock')}<strong data-rocks>${this.progress.profile.rocks}</strong><span>ROCKS</span></div>
        </div>
      </header>
      <div class="market-welcome"><span>THE WOODS CAN WAIT</span><p>Good company.<br>Useful little treasures.</p><i></i><small>A golden afternoon on the square. Meet the neighbors, browse their stalls, and bring a little luck into the woods.</small></div>
      <aside class="market-fieldnotes"><span class="market-eyebrow">A LITTLE GOES A LONG WAY</span><h2>From the woods,<br>for the journey.</h2><p>Gold begins flowing at level 3, and rare rocks drop along the trail.</p><dl><div><dt>Level 3–9</dt><dd>1–3 gold</dd></div><div><dt>Level 10 / 15</dt><dd>5 / 7 gold</dd></div><div><dt>Level 20+</dt><dd>10 + 1 / lv</dd></div></dl><small>Everything you buy stays with you for future adventures.</small></aside>
      <div class="market-map-tools"><button class="market-zoom" aria-label="Look closer at the square">+</button></div>
      <div class="market-interact" hidden><button type="button"></button></div>
      <footer class="market-footer"><div class="market-directions"><span><kbd>WASD</kbd> / <kbd>↑ ↓ ← →</kbd> to wander · click the square to stroll · <kbd>E</kbd> to shop</span><button class="market-adventure">Back to the woods ${icon('arrow')}</button></div><nav class="market-directory" aria-label="Market vendors">${MARKET_VENDORS.map(v => {
        const emblem = MARKET_ITEMS.find(item => item.vendorId === v.id && item.kind !== 'character')!;
        return `<button data-vendor="${v.id}" style="--vendor-color:#${v.accent.toString(16)}"><span class="vendor-symbol">${marketItemIcon(emblem.icon)}</span><span><strong>${v.name}</strong><small>${v.keeper} · ${v.tagline}</small></span><b>↗</b></button>`;
      }).join('')}</nav></footer>
      <div class="market-toast" role="status" aria-live="polite" hidden></div>
      ${this.preview ? '<div class="market-preview">Preview purse · purchases stay in this preview</div>' : ''}
    </div>`;
    const touchHint = document.createElement('span'); touchHint.className='market-touch-hint';
    touchHint.textContent='Tap the square to stroll · tap a stall to shop';
    this.root.querySelector('.market-directions')!.prepend(touchHint);
    this.root.querySelector('.market-back')!.addEventListener('click', () => { audioSystem.play('ui-click'); this.returnToTitle(); });
    this.root.querySelector('.market-adventure')!.addEventListener('click', () => { audioSystem.play('ui-click'); this.startAdventure(); });
    this.root.querySelector('.market-zoom')!.addEventListener('click', () => { audioSystem.play('ui-click'); this.zoomed = !this.zoomed; this.resize(); });
    this.root.querySelector('.market-interact button')!.addEventListener('click', () => { if (this.nearestVendor) { audioSystem.play('ui-click'); this.openShop(this.nearestVendor); } });
    this.root.querySelectorAll<HTMLButtonElement>('[data-vendor]').forEach(button => button.addEventListener('click', () => { audioSystem.play('ui-click'); this.visit(button.dataset.vendor as MarketVendorId); }));
    this.input.on('pointerdown', this.onMapClick, this);
    window.addEventListener('keydown', this.onKey);
    this.scale.on('resize', this.onResize);
    this.resize();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    if (this.preview || data.vendorId) {
      const requested = data.vendorId ?? new URLSearchParams(location.search).get('shop');
      const vendor = this.world.vendors.find(v => v.id === requested);
      if (vendor) { this.player.setPosition(vendor.interactionX, vendor.interactionY).setDepth(vendor.interactionY); this.nearestVendor=vendor.id; this.openShop(vendor.id); }
    }
    if (!this.preview && this.progress.storageStatus !== 'ready') this.notify('Your browser cannot save this purse yet. Purchases will stay for this session.');
  }

  private onMapClick(pointer: Phaser.Input.Pointer): void {
    if (this.shop || this.leaving) return;
    const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const vendor = this.world.vendors.find(v => Math.abs(p.x - v.x) < 125 && p.y > v.y - 125 && p.y < v.interactionY + 25);
    if (vendor) { this.visit(vendor.id); return; }
    if (p.x < 30 || p.x > WIDTH - 30 || p.y < 470 || p.y > HEIGHT - 35) return;
    this.visiting = undefined; this.path = this.world.findPath(this.player, p, 18);
    this.drawDestination();
  }

  private visit(id: MarketVendorId): void {
    const vendor = this.world.vendors.find(v => v.id === id)!;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, vendor.interactionX, vendor.interactionY) <= 110) { this.openShop(id); return; }
    this.visiting = id;
    this.path = this.world.findPath(this.player, {x:vendor.interactionX,y:vendor.interactionY},18);
    this.drawDestination();
    this.notify(`Strolling over to ${MARKET_VENDORS.find(v => v.id === id)!.keeper}…`);
  }

  private drawDestination(): void {
    this.destination.clear();
    const point = this.path[this.path.length - 1];
    if (point) this.destination.lineStyle(2, 0xffe3a0, .9).strokeEllipse(point.x, point.y, 30, 14);
  }

  update(_time: number, delta: number): void {
    if (!this.world || this.leaving) return;
    const dt = Math.min(delta, 50); this.world.update(dt);
    if (this.shop) { this.cosmetic.update(dt, this.player, this.progress.equippedCosmetics); return; }
    let dx = Number(this.keys.d.isDown || this.keys.right.isDown) - Number(this.keys.a.isDown || this.keys.left.isDown);
    let dy = Number(this.keys.s.isDown || this.keys.down.isDown) - Number(this.keys.w.isDown || this.keys.up.isDown);
    if (dx || dy) { this.path = []; this.visiting = undefined; this.destination.clear(); }
    let travel = 205 * dt / 1000;
    if (!dx && !dy && this.path.length) {
      const target = this.path[0], distance = Phaser.Math.Distance.Between(this.player.x,this.player.y,target.x,target.y);
      if (distance < 5) this.path.shift();
      else { dx = target.x - this.player.x; dy = target.y - this.player.y; travel = Math.min(travel, distance); }
    }
    const length = Math.hypot(dx, dy), before = {x:this.player.x,y:this.player.y};
    const safe = length ? this.world.move(before, {x:before.x + dx/length*travel,y:before.y + dy/length*travel},18) : before;
    this.player.setPosition(safe.x,safe.y).setDepth(safe.y);
    this.cosmetic.update(dt, this.player, this.progress.equippedCosmetics);
    const moving = Math.hypot(safe.x-before.x,safe.y-before.y) > .01;
    if (moving) this.facing = { x: (safe.x-before.x)/travel, y: (safe.y-before.y)/travel };
    const animation = moving ? this.character.animationForDirection(this.facing) : this.character.idleForDirection?.(this.facing) ?? this.character.idleAnimation;
    this.player.play(animation.key,true).setFlipX(Boolean(animation.flipX));
    if (!this.path.length) this.destination.clear();
    const closest = this.world.vendors.map(v => ({v,d:Phaser.Math.Distance.Between(safe.x,safe.y,v.interactionX,v.interactionY)})).sort((a,b)=>a.d-b.d)[0];
    this.nearestVendor = closest.d < 110 ? closest.v.id : undefined;
    const prompt = this.root.querySelector<HTMLElement>('.market-interact')!;
    prompt.hidden = !this.nearestVendor;
    if (this.nearestVendor) prompt.querySelector('button')!.innerHTML = `<kbd>E</kbd> Browse ${MARKET_VENDORS.find(v=>v.id===this.nearestVendor)!.name}`;
    if (this.visiting && this.nearestVendor === this.visiting) this.openShop(this.visiting);
  }

  private refreshHeaderBalances(): void {
    const profile = this.progress.profile;
    const goldEl = this.root.querySelector('[data-gold]');
    const rocksEl = this.root.querySelector('[data-rocks]');
    if (goldEl) goldEl.textContent = String(profile.gold);
    if (rocksEl) rocksEl.textContent = String(profile.rocks);
  }

  private openShop(id: MarketVendorId): void {
    this.path = []; this.visiting = undefined; this.destination.clear(); this.shop = id;
    const idle = this.character.idleForDirection?.(this.facing) ?? this.character.idleAnimation;
    this.player.play(idle.key,true).setFlipX(Boolean(idle.flipX));
    this.root.querySelector<HTMLElement>('.market-interact')!.hidden = true;
    this.progress.refresh();
    this.refreshHeaderBalances();
    this.root.querySelector('.market-ui')?.setAttribute('inert', '');
    this.renderShop();
  }

  private renderShop(focusItem?: string): void {
    this.root.querySelector('.market-shop-overlay')?.remove();
    if (!this.shop) return;
    const vendor = MARKET_VENDORS.find(v=>v.id===this.shop)!;
    const profile = this.progress.profile;
    const stock = MARKET_ITEMS.filter(item => item.vendorId === this.shop && item.kind !== 'character');
    const outfitterSlots = this.shop === 'outfitter'
      ? `<div class="outfitter-slots" aria-label="Equipped cosmetic slots">${COSMETIC_SLOTS.map(slot => {
        const equippedId = profile.equippedCosmetics[slot];
        const equippedName = equippedId ? (MARKET_ITEMS.find(item => item.id === equippedId)?.name ?? equippedId) : 'Empty';
        return `<span class="${equippedId ? 'slot-active' : ''}"><strong>${COSMETIC_SLOT_LABELS[slot]}</strong><small>${equippedName}</small></span>`;
      }).join('')}</div>`
      : '';
    const panel = document.createElement('div'); panel.className='market-shop-overlay';
    panel.innerHTML = `<section class="market-shop" role="dialog" aria-modal="true" aria-labelledby="shop-title" aria-describedby="shop-greeting" style="--shop-color:#${vendor.accent.toString(16)}"><button class="shop-close" aria-label="Close shop">${icon('cross')}</button><p class="market-eyebrow">MARKET DAY · ${vendor.keeper.toUpperCase()}'S STALL</p><h2 id="shop-title">${vendor.name}</h2><p id="shop-greeting" class="shop-greeting">“${vendor.greeting}”</p><div class="shop-summary"><span>${icon('leaf')} Yours for every future adventure</span><div class="shop-currencies"><b>${icon('gold')} ${profile.gold} gold</b><b class="shop-rock-balance">${icon('rock')} ${profile.rocks} rocks</b></div></div>${outfitterSlots}<div class="market-items">${this.shop==='forge'?`<article class="market-item fully-owned"><div class="market-item-art">${marketItemIcon('charm')}<span>${this.weaponId==='spell'?'✓ EQUIPPED':'✓ OWNED'}</span></div><h3>${WEAPONS.spell.name}</h3><p class="market-item-story">${WEAPONS.spell.description}</p><p class="market-item-rule">Your starting weapon. Always available.</p><button data-weapon="spell" ${this.weaponId==='spell'?'disabled':''}>${this.weaponId==='spell'?'Equipped':'Equip'}</button></article>`:''}${stock.map(item=>{
      const preview=marketItemPreview(this,item,this.character.id);
      const artwork=preview?`<img class="market-item-preview" src="${preview}" alt="${item.name} preview">`:marketItemIcon(item.icon);
      const rank=profile.ranks[item.id]??0,price=marketItemPrice(item.id,rank),full=price===null;
      const currency=marketItemCurrency(item);
      const wallet=currency==='rocks'?profile.rocks:profile.gold;
      const affordable=!full&&wallet>=price;
      const cosmetic=item.kind==='cosmetic';
      const slot=cosmetic?(item.cosmeticSlot??getCosmeticSlot(item.id)):null;
      const weaponTarget=item.kind==='weapon'?WEAPON_BY_MARKET_ITEM[item.id]:undefined;
      const equipped=slot?profile.equippedCosmetics[slot]===item.id:Boolean(weaponTarget&&this.weaponId===weaponTarget);
      const currencyIcon=icon(currency==='rocks'?'rock':'gold');
      const unitLabel=currency==='rocks'?(price===1?'rock':'rocks'):'gold';
      const shortfallUnit=currency==='rocks'?(price!==null&&price-wallet===1?'rare rock':'rare rocks'):'gold';
      const badgeText=equipped
        ?(slot?`${COSMETIC_SLOT_LABELS[slot].toUpperCase()} · ✓ EQUIPPED`:'✓ EQUIPPED')
        :full
        ?(slot?`${COSMETIC_SLOT_LABELS[slot].toUpperCase()} · ✓ OWNED`:'✓ OWNED')
        :rank
        ?`RANK ${rank} / ${item.maxRank}`
        :slot
        ?`${COSMETIC_SLOT_LABELS[slot].toUpperCase()} · COSMETIC`
        :item.kind
        ?'PERMANENT UNLOCK'
        :currency==='rocks'
        ?'RARE ROCK CURIO'
        :'PERMANENT UPGRADE';
      const action=item.kind==='weapon'&&full&&weaponTarget
        ? `<button data-weapon="${weaponTarget}" ${equipped?'disabled':''}>${equipped?'Equipped':'Equip'}</button>`
        : cosmetic&&full&&slot
        ? `<button data-equip="${item.id}" data-slot="${slot}" data-equipped="${equipped?'1':'0'}">${equipped?'Unequip':'Equip'}</button>`
        : `<button data-buy="${item.id}" ${!affordable?'disabled':''}>${full?(item.kind?'Unlocked':'Fully upgraded'):`${currencyIcon} ${price} ${unitLabel} <span>${item.kind==='weapon'?'Unlock':rank?'Improve':'Buy'}</span>`}</button>`;
      return `<article class="market-item ${full?'fully-owned':''} ${currency==='rocks'?'rock-curio':''}"><div class="market-item-art" style="--item-color:#${item.accent.toString(16)}">${artwork}<span>${badgeText}</span></div><h3>${item.name}</h3><p class="market-item-story">${item.description}</p><div class="market-item-benefits"><span><small>YOU HAVE</small>${rank?marketItemBenefit(item.id,rank):'Not owned yet'}</span>${!full?`<span><small>AFTER THIS PURCHASE</small><b>${marketItemBenefit(item.id,rank+1)}</b></span>`:''}</div><p class="market-item-rule">${item.effect}</p>${action}${!full&&!affordable?`<small class="market-shortfall">${price-wallet} more ${shortfallUnit} needed</small>`:!item.kind?`<small class="market-shortfall">${rank} / ${item.maxRank} ranks owned</small>`:''}</article>`;
    }).join('')}</div><p class="shop-note">Gold starts at level 3 (Lv 10: 5, Lv 15: 7, Lv 20: 10, +1 per level after). Rare rocks drop in the woods.</p><div class="shop-feedback" role="status">${this.status}</div></section>`;
    const merchant = this.world.vendors.find(v => v.id === vendor.id)!;
    const portrait = document.createElement('img');
    portrait.className = 'market-merchant-portrait'; portrait.alt = `${vendor.keeper}, your ${merchant.title.toLowerCase()}`;
    portrait.src = this.textures.getBase64(merchant.portraitKey, merchant.portraitFrame);
    panel.querySelector('.market-eyebrow')!.before(portrait);
    this.root.append(panel);
    panel.querySelector('.shop-close')!.addEventListener('click',()=>{audioSystem.play('ui-click');this.closeShop();});
    panel.addEventListener('click',event=>{if(event.target===panel){audioSystem.play('ui-click');this.closeShop();}});
    panel.querySelectorAll<HTMLButtonElement>('[data-weapon]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.weapon as AnyWeaponId;
      if(this.progress.equipWeapon(id)) {
        audioSystem.play('upgrade-pick');
        this.weaponId=id;
        this.status=`${weaponLabel(id)} equipped for your next adventure.`;
        if(this.progress.storageStatus!=='ready') this.status+=' Saved for this preview or session.';
      } else {
        audioSystem.play('ui-click');
      }
      this.renderShop();
    }));
    panel.querySelectorAll<HTMLButtonElement>('[data-equip]').forEach(button=>button.addEventListener('click',()=>{
      const itemId=button.dataset.equip as CosmeticId;
      const slot=button.dataset.slot as CosmeticSlot;
      const wasEquipped=button.dataset.equipped==='1';
      const itemName=MARKET_ITEMS.find(item=>item.id===itemId)?.name??itemId;
      if(this.progress.equipCosmeticSlot(slot,wasEquipped?null:itemId)) {
        audioSystem.play('upgrade-pick');
        this.status=wasEquipped?`${itemName} unequipped.`:`${itemName} equipped in your ${COSMETIC_SLOT_LABELS[slot].toLowerCase()} slot.`;
      } else {
        audioSystem.play('ui-click');
      }
      if(this.progress.storageStatus!=='ready') this.status+=' Saved for this preview or session.';
      this.renderShop(itemId);
    }));
    panel.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(button=>button.addEventListener('click',()=>{
      const boughtId=button.dataset.buy!;
      const result=this.progress.purchase(boughtId);
      const item=MARKET_ITEMS.find(item=>item.id===boughtId)!;
      if (result.status==='purchased') {
        audioSystem.play('upgrade-pick');
        const weaponTarget = item.kind==='weapon' ? WEAPON_BY_MARKET_ITEM[item.id] : undefined;
        if (weaponTarget && this.progress.equipWeapon(weaponTarget)) {
          this.weaponId = weaponTarget;
        }
        this.status=`${item.name} is yours. ${ weaponTarget ? `${weaponLabel(weaponTarget)} equipped for your next adventure.` : `${marketItemBenefit(item.id,result.rank)}.` }${item.kind==='cosmetic'?' Equip it here to wear it.':''}${result.saved?'':' Saved for this preview or session.'}`;
      } else {
        audioSystem.play('ui-click');
        if (result.status==='insufficient-rocks') {
          this.status='You need a few more rare rocks from the woods first.';
        } else if (result.status==='insufficient-gold') {
          this.status='Your purse has changed. Earn a little more gold first.';
        } else {
          this.status='This item is already fully upgraded.';
        }
      }
      this.refreshHeaderBalances();
      this.renderShop(boughtId);
    }));
    const focus=focusItem
      ?(panel.querySelector<HTMLButtonElement>(`[data-buy="${focusItem}"]:not(:disabled)`)
        ??panel.querySelector<HTMLButtonElement>(`[data-equip="${focusItem}"]:not(:disabled)`))
      :undefined;
    (focus??panel.querySelector<HTMLButtonElement>('.shop-close'))?.focus({preventScroll:true});
  }

  private closeShop(): void {
    this.shop=undefined;this.status='';this.root.querySelector('.market-shop-overlay')?.remove();
    this.root.querySelector('.market-ui')?.removeAttribute('inert');
    this.root.querySelector<HTMLButtonElement>(`[data-vendor="${this.nearestVendor}"]`)?.focus({preventScroll:true});
  }

  private notify(message:string):void {
    const toast=this.root.querySelector<HTMLElement>('.market-toast')!;toast.textContent=message;toast.hidden=false;
    this.time.delayedCall(3500,()=>{if(toast.textContent===message)toast.hidden=true;});
  }

  private resize(): void {
    const width=this.scale.width,height=this.scale.height;
    const top=width<650?68:76,bottom=width<650?156:126;
    const viewHeight=Math.max(160,height-top-bottom),fit=Math.min(width/WIDTH,viewHeight/HEIGHT);
    const zoom = fit*(this.zoomed?1.7:1);
    const viewportWidth = Math.min(width, WIDTH*zoom);
    const viewportHeight = Math.min(viewHeight, HEIGHT*zoom);
    const viewportY = top+(viewHeight-viewportHeight)/2;
    this.cameras.main.setViewport((width-viewportWidth)/2,viewportY,viewportWidth,viewportHeight).setBounds(0,0,WIDTH,HEIGHT).setZoom(zoom);
    const mapTools=this.root.querySelector<HTMLElement>('.market-map-tools')!;
    mapTools.style.top=`${viewportY+16}px`; mapTools.style.right=`${(width-viewportWidth)/2+16}px`;
    this.root.querySelector('.market-ui')?.classList.toggle('market-close-view', this.zoomed || (width-viewportWidth)/2<210);
    if(this.zoomed)this.cameras.main.startFollow(this.player,true,.12,.12);
    else {this.cameras.main.stopFollow();this.cameras.main.centerOn(WIDTH/2,HEIGHT/2);}
    const button=this.root?.querySelector<HTMLButtonElement>('.market-zoom');
    if(button){button.textContent=this.zoomed?'−':'+';button.setAttribute('aria-label',this.zoomed?'See the whole square':'Look closer at the square');}
  }

  private returnToTitle():void {if(this.leaving)return;this.leaving=true;this.scene.start('StartScene',{skipReview:true,characterId:this.character.id,weaponId:this.weaponId});}
  private startAdventure():void {if(this.leaving)return;this.leaving=true;this.scene.start('GameScene',{characterId:this.character.id,weaponId:this.weaponId,skipReview:true});}
  private cleanup():void {
    window.removeEventListener('keydown',this.onKey);this.scale.off('resize',this.onResize);
    this.input.off('pointerdown',this.onMapClick,this);this.world?.destroy();this.root.innerHTML='';
  }
}
