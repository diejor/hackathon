using System;
using Net.Codecrete.QrCodeGenerator;
using RishUI;
using RishUI.Elements;
using RishUI.MemoryManagement;
using Roots;
using UnityEngine;
using UnityEngine.UIElements;
using Label = RishUI.Elements.Label;
using StyleBackground = UnityEngine.UIElements.StyleBackground;

namespace Hackathon.UI
{
    // Big touch-friendly button. Visual states are separate Divs so USS can style pressed/disabled.
    public partial class Btn : RishElement<BtnProps>
    {
        public enum Variant { Primary, Secondary, Ghost, Danger }

        protected override Element Render()
        {
            var variant = Props.variant switch
            {
                Variant.Secondary => "btn-secondary",
                Variant.Ghost => "btn-ghost",
                Variant.Danger => "btn-danger",
                _ => "btn-primary",
            };
            var baseClass = new ClassName { "btn", variant };
            if (Props.small) baseClass += "btn-small";

            return AbstractButton.Create(
                interactable: !Props.disabled,
                normal: Content(baseClass),
                pressed: Content(baseClass + "pressed"),
                disabled: Content(baseClass + "disabled"),
                action: SappyProps.Action);
        }

        [RequiresManagedContext]
        Element Content(ClassName className) => Div.Create(
            className: className,
            children: Label.Create(className: "btn-label", text: Props.label));
    }

    [RishValueType]
    public struct BtnProps
    {
        public RishString label;
        public Btn.Variant variant;
        public bool disabled;
        public bool small;
        public Action action;
    }

    // One key of the room-code keypad.
    public partial class KeyButton : RishElement<KeyButtonProps>
    {
        protected override Element Render() => AbstractButton.Create(
            interactable: !Props.disabled,
            normal: Key("key"),
            pressed: Key(new ClassName { "key", "pressed" }),
            disabled: Key(new ClassName { "key", "disabled" }),
            action: (Action)Press);

        [RequiresManagedContext]
        Element Key(ClassName className) => Div.Create(
            className: Props.wide ? className + "key-wide" : className,
            children: Label.Create(className: "key-label", text: Props.label));

        void Press() => Props.onPress?.Invoke(Props.value);
    }

    [RishValueType]
    public struct KeyButtonProps
    {
        public RishString label;
        public char value;
        public bool wide;
        public bool disabled;
        public Action<char> onPress;
    }

    // Vertical scroller for phones + desktop. Put it inside a viewport with `overflow: hidden`; it moves
    // itself with style.translate. Replaces UI Toolkit's ScrollView, which on WebGL jumps ~100px per
    // trackpad tick, overshoots/snaps on wheel, and hitches when a drag starts on a button.
    //  - touch/mouse drag: 1:1 from the moment the drag starts (no catch-up jump), momentum, soft edges
    //  - wheel/trackpad: pixel-based, eased, clamped
    //  - a drag that starts on a button steals the pointer, so the button never fires
    // Props.page: change it (e.g. per screen) to reset the scroll position to the top.
    public partial class Scroller : VisualElement, IVisualElement<ScrollerProps>
    {
        Bridge<ScrollerProps> Bridge { get; }
        Bridge<ScrollerProps> IVisualElement<ScrollerProps>.Bridge => Bridge;
        PickingManager PickingManager { get; }
        PickingManager ICustomPicking.Manager => PickingManager;

        const float DragSlop = 8f;          // px before a press becomes a scroll
        const float WheelScale = 1.5f;      // WheelEvent.delta units -> px
        const float Friction = 3.5f;        // momentum decay per second (exp)
        const float EdgeResistance = 0.35f; // how far you can pull past the ends while dragging
        const float Spring = 16f;           // snap-back speed at the ends

        float _offset, _velocity, _wheelTarget = float.NaN;
        int _pointerId = PointerId.invalidPointerId;
        bool _dragging;
        float _startY, _dragBase, _lastY;
        long _lastTs;
        uint _page;

        public Scroller()
        {
            Bridge = new Bridge<ScrollerProps>(this);
            PickingManager = new RectPickingManager(Bridge);
            RegisterCallback<PointerDownEvent>(OnDown, TrickleDown.TrickleDown);
            RegisterCallback<PointerMoveEvent>(OnMove, TrickleDown.TrickleDown);
            RegisterCallback<PointerUpEvent>(OnUp, TrickleDown.TrickleDown);
            RegisterCallback<PointerCancelEvent>(OnCancel, TrickleDown.TrickleDown);
            RegisterCallback<WheelEvent>(OnWheel, TrickleDown.TrickleDown);
            RegisterCallback<GeometryChangedEvent>(_ => Apply(Mathf.Clamp(_offset, 0, Max)));
            schedule.Execute(Tick).Every(0);
        }

        public override bool ContainsPoint(Vector2 localPoint) => PickingManager.ContainsPoint(localPoint);

        void IVisualElement<ScrollerProps>.Setup(ScrollerProps props)
        {
            if (props.page != _page)
            {
                _page = props.page;
                _offset = 0; _velocity = 0; _wheelTarget = float.NaN;
            }
            Apply(_offset);
        }

        float Max => parent == null ? 0 : Mathf.Max(0, layout.height - parent.layout.height);

        void OnDown(PointerDownEvent e)
        {
            if (_pointerId != PointerId.invalidPointerId) return;
            _pointerId = e.pointerId;
            _dragging = false;
            _startY = _lastY = e.position.y;
            _lastTs = e.timestamp;
            _velocity = 0;
            _wheelTarget = float.NaN;
        }

        void OnMove(PointerMoveEvent e)
        {
            if (e.pointerId != _pointerId) return;
            var y = e.position.y;
            if (!_dragging)
            {
                if (Mathf.Abs(y - _startY) < DragSlop) return;
                _dragging = true;
                _dragBase = _offset + y; // start from here: no jump
                this.CapturePointer(e.pointerId);
            }

            var target = _dragBase - y;
            var max = Max;
            if (target < 0) target *= EdgeResistance;
            else if (target > max) target = max + (target - max) * EdgeResistance;

            var dt = Mathf.Max((e.timestamp - _lastTs) / 1000f, 0.004f);
            _velocity = Mathf.Lerp(_velocity, (_lastY - y) / dt, 0.5f);
            _lastY = y;
            _lastTs = e.timestamp;
            Apply(target);
            e.StopPropagation();
        }

        void OnUp(PointerUpEvent e) { if (e.pointerId == _pointerId) End(e); }
        void OnCancel(PointerCancelEvent e) { if (e.pointerId == _pointerId) End(e); }

        void End(IPointerEvent pe)
        {
            var e = (EventBase)pe;
            if (_dragging)
            {
                if (this.HasPointerCapture(_pointerId)) this.ReleasePointer(_pointerId);
                if (e.timestamp - _lastTs > 80) _velocity = 0; // finger stopped before lifting
                e.StopPropagation();
            }
            else _velocity = 0;
            _dragging = false;
            _pointerId = PointerId.invalidPointerId;
        }

        void OnWheel(WheelEvent e)
        {
            var max = Max;
            if (max <= 0) return;
            var from = float.IsNaN(_wheelTarget) ? _offset : _wheelTarget;
            _wheelTarget = Mathf.Clamp(from + e.delta.y * WheelScale, 0, max);
            _velocity = 0;
            e.StopPropagation();
        }

        void Tick(TimerState _)
        {
            if (_dragging || panel == null) return;
            var dt = Mathf.Min(Time.unscaledDeltaTime, 0.05f);
            var max = Max;
            var o = _offset;

            if (!float.IsNaN(_wheelTarget))
            {
                o = Mathf.Lerp(o, _wheelTarget, 1 - Mathf.Exp(-dt * 20f));
                if (Mathf.Abs(o - _wheelTarget) < 0.5f) { o = _wheelTarget; _wheelTarget = float.NaN; }
            }
            else
            {
                if (_velocity != 0)
                {
                    o += _velocity * dt;
                    var decay = o < 0 || o > max ? 20f : Friction; // stop fast once past an edge
                    _velocity *= Mathf.Exp(-dt * decay);
                    if (Mathf.Abs(_velocity) < 10f) _velocity = 0;
                }
                if (_velocity == 0 || o < 0 || o > max)
                {
                    var clamped = Mathf.Clamp(o, 0, max);
                    if (o != clamped)
                    {
                        o = Mathf.Lerp(o, clamped, 1 - Mathf.Exp(-dt * Spring));
                        if (Mathf.Abs(o - clamped) < 0.5f) o = clamped;
                    }
                }
            }
            if (o != _offset) Apply(o);
        }

        void Apply(float o)
        {
            _offset = o;
            style.translate = new Translate(0, -Mathf.Round(o * 2f) / 2f);
        }
    }

    [RishValueType]
    public struct ScrollerProps
    {
        public uint page;
    }

    // Renders a QR code for Props.text as a crisp pixel texture.
    public partial class QrImage : VisualElement, IVisualElement<QrImageProps>, IMountingListener
    {
        Bridge<QrImageProps> Bridge { get; }
        Bridge<QrImageProps> IVisualElement<QrImageProps>.Bridge => Bridge;
        PickingManager PickingManager { get; }
        PickingManager ICustomPicking.Manager => PickingManager;

        Texture2D _texture;
        string _encoded;

        public QrImage()
        {
            Bridge = new Bridge<QrImageProps>(this);
            PickingManager = new RectPickingManager(Bridge);
        }

        public override bool ContainsPoint(Vector2 localPoint) => PickingManager.ContainsPoint(localPoint);

        void IVisualElement<QrImageProps>.Setup(QrImageProps props)
        {
            var text = props.text.ToString();
            if (text == _encoded) return;
            _encoded = text;
            if (string.IsNullOrEmpty(text)) { style.backgroundImage = StyleKeyword.None; return; }

            var qr = QrCode.EncodeText(text, QrCode.Ecc.Medium);
            const int quiet = 2; // white border so scanners lock on
            var size = qr.Size + quiet * 2;
            if (_texture == null || _texture.width != size)
            {
                if (_texture != null) UnityEngine.Object.Destroy(_texture);
                _texture = new Texture2D(size, size, TextureFormat.RGBA32, false)
                {
                    filterMode = FilterMode.Point,
                    wrapMode = TextureWrapMode.Clamp,
                };
            }
            var pixels = new Color32[size * size];
            var dark = new Color32(20, 20, 24, 255);
            var light = new Color32(255, 255, 255, 255);
            for (var y = 0; y < size; y++)
            for (var x = 0; x < size; x++)
            {
                var qx = x - quiet;
                var qy = y - quiet;
                var on = qx >= 0 && qy >= 0 && qx < qr.Size && qy < qr.Size && qr.GetModule(qx, qy);
                // Texture rows go bottom-up; QR rows go top-down.
                pixels[(size - 1 - y) * size + x] = on ? dark : light;
            }
            _texture.SetPixels32(pixels);
            _texture.Apply(false);
            style.backgroundImage = new StyleBackground(_texture);
        }

        void IMountingListener.ElementDidMount() { }

        void IMountingListener.ElementWillUnmount()
        {
            if (_texture != null) UnityEngine.Object.Destroy(_texture);
            _texture = null;
            _encoded = null;
        }
    }

    [RishValueType]
    public struct QrImageProps
    {
        public RishString text;
    }
}
