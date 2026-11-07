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

    // Native UI Toolkit ScrollView (touch/elastic scrolling on phones). Rish adds children with
    // parent.Add(), which ScrollView routes into its content container.
    public partial class Scroll : UnityEngine.UIElements.ScrollView, IVisualElement
    {
        Bridge Bridge { get; }
        Bridge IVisualElement.Bridge => Bridge;
        PickingManager PickingManager { get; }
        PickingManager ICustomPicking.Manager => PickingManager;

        public Scroll() : base(ScrollViewMode.Vertical)
        {
            Bridge = new Bridge(this);
            PickingManager = new RectPickingManager(Bridge);
            touchScrollBehavior = TouchScrollBehavior.Elastic;
            horizontalScrollerVisibility = ScrollerVisibility.Hidden;
            verticalScrollerVisibility = ScrollerVisibility.Hidden;
        }

        public override bool ContainsPoint(Vector2 localPoint) => PickingManager.ContainsPoint(localPoint);

        void IVisualElement.Setup() { }
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
