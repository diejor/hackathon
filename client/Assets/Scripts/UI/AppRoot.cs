using System;
using System.Linq;
using RishUI;
using RishUI.Elements;
using RishUI.MemoryManagement;
using Roots;
using SpacetimeDB.Types;
using UnityEngine;

namespace Hackathon.UI
{
    // Entry point referenced by RishRoot (_rootClassName = "Hackathon.UI.HackathonApp").
    public class HackathonApp : IApp
    {
        [RequiresManagedContext]
        Element IApp.GetRoot(bool recovered) => AppRoot.Create();
    }

    // Re-renders whenever the Lobby store changes. All screens are pure functions of Lobby state.
    public partial class AppRoot : RishElement<NoProps, AppRootState>, IMountingListener
    {
        void IMountingListener.ElementDidMount()
        {
            Lobby.Changed += OnLobbyChanged;
            OnLobbyChanged();
        }

        void IMountingListener.ElementWillUnmount() => Lobby.Changed -= OnLobbyChanged;

        void OnLobbyChanged() => SetVersion(Lobby.Version);

        protected override Element Render()
        {
            var children = new Children
            {
                Header(),
                // .body is the clipping viewport; Scroller moves inside it (resets per screen).
                Div.Create(className: "body", children: Scroller.Create(
                    className: "scroller",
                    page: (uint)Lobby.CurrentScreen,
                    children: Lobby.CurrentScreen switch
                    {
                        Lobby.Screen.Home => Home(),
                        Lobby.Screen.Join => Join(),
                        Lobby.Screen.Room => RoomScreen(),
                        Lobby.Screen.Playing => Playing(),
                        _ => Connecting(),
                    })),
            };
            if (Lobby.Error is { } err) children.Add(Label.Create(className: "toast", text: err));
            return Div.Create(className: "app", children: children);
        }

        // ---------- Screens ----------

        [RequiresManagedContext]
        static Element Header() => Div.Create(className: "header", children: new Children
        {
            Div.Create(className: "brand-mark"),
            Label.Create(className: "brand", text: "SECURITY ARCADE"),
        });

        [RequiresManagedContext]
        static Element Connecting() => Div.Create(className: "screen center", children: new Children
        {
            Div.Create(className: "spinner"),
            Label.Create(className: "muted", text: Lobby.ConnectError is { } e ? $"Reconnecting… ({e})" : "Connecting…"),
        });

        [RequiresManagedContext]
        static Element Home() => Div.Create(className: "screen", children: new Children
        {
            Div.Create(className: "hero", children: new Children
            {
                Label.Create(className: "h1", text: "Play security games\nwith friends"),
                Label.Create(className: "muted", text: "Create a room and share the code or QR, or join a friend's room."),
            }),
            Div.Create(className: "card name-card", children: new Children
            {
                Label.Create(className: "label-small", text: "PLAYING AS"),
                Div.Create(className: "row", children: new Children
                {
                    Label.Create(className: "name grow", text: Lobby.MyName),
                    Btn.Create(label: "New name", variant: Btn.Variant.Ghost, small: true, action: Lobby.RerollName),
                }),
            }),
            Div.Create(className: "stack", children: new Children
            {
                Btn.Create(label: Lobby.Busy == "create" ? "Creating…" : "Create room", disabled: Lobby.Busy != null, action: Lobby.CreateRoom),
                Btn.Create(label: "Join with code", variant: Btn.Variant.Secondary, disabled: Lobby.Busy != null, action: Lobby.OpenJoin),
            }),
            Label.Create(className: "hint", text: "Got a QR? Just scan it with your camera."),
        });

        [RequiresManagedContext]
        static Element Join()
        {
            var code = Lobby.TypedCode;
            var slots = new Children();
            for (var i = 0; i < Lobby.CodeLength; i++)
            {
                var filled = i < code.Length;
                var cls = new ClassName { "code-slot" };
                if (filled) cls += "filled";
                if (i == code.Length) cls += "active";
                slots.Add(Div.Create(key: (ulong)i, className: cls,
                    children: Label.Create(className: "code-char", text: filled ? code[i].ToString() : "")));
            }

            var busy = Lobby.Busy == "join";
            var keys = new Children();
            ulong k = 0;
            foreach (var c in Lobby.CodeAlphabet)
                keys.Add(KeyButton.Create(key: k++, label: c.ToString(), value: c, disabled: busy || code.Length >= Lobby.CodeLength, onPress: Lobby.TypeChar));
            keys.Add(KeyButton.Create(key: k++, label: "DEL", value: '\b', wide: true, disabled: busy || code.Length == 0, onPress: OnKeypadSpecial));

            return Div.Create(className: "screen", children: new Children
            {
                Div.Create(className: "row", children: new Children
                {
                    Btn.Create(label: "Back", variant: Btn.Variant.Ghost, small: true, action: Lobby.BackHome),
                }),
                Label.Create(className: "h2", text: busy ? "Joining…" : "Enter room code"),
                Div.Create(className: "code-slots", children: slots),
                Div.Create(className: "keypad", children: keys),
            });
        }

        static void OnKeypadSpecial(char c)
        {
            if (c == '\b') Lobby.Backspace();
        }

        [RequiresManagedContext]
        static Element RoomScreen()
        {
            var room = Lobby.MyRoom;
            var members = Lobby.Members;
            var isHost = Lobby.IsHost;
            var me = Lobby.Me;

            var list = new Children();
            foreach (var m in members)
            {
                var isMe = me != null && m.Identity == me.Identity;
                var tags = m.Identity == room.Host ? "HOST" : "";
                if (!m.Online) tags = tags.Length > 0 ? tags + " · OFFLINE" : "OFFLINE";
                list.Add(Div.Create(key: m.Seat, className: isMe ? new ClassName { "member", "me" } : "member", children: new Children
                {
                    Div.Create(className: new ClassName { "seat-dot", $"seat-{m.Seat % 8}" }),
                    Div.Create(className: "member-text grow", children: new Children
                    {
                        Label.Create(className: "member-name", text: isMe ? $"{m.Name} (you)" : m.Name),
                        Label.Create(className: "member-tags", text: tags),
                    }),
                    Label.Create(className: m.Ready ? "ready-pill on" : "ready-pill", text: m.Ready ? "READY" : "…"),
                }));
            }

            var games = new Children();
            ulong gk = 0;
            foreach (var g in Lobby.Games)
            {
                var selected = room.Game == g.Id;
                var gameId = g.Id;
                games.Add(GameCard.Create(key: gk++, title: g.Title, blurb: g.Blurb, selected: selected, interactable: isHost, gameId: gameId, onPick: Lobby.ChooseGame));
            }

            var readyCount = members.Count(m => m.Ready);
            string startHint;
            if (members.Count < Lobby.MinPlayers) startHint = "Waiting for another player to join…";
            else if (room.Game == "") startHint = isHost ? "Pick a game" : "Host is picking a game…";
            else if (readyCount < members.Count) startHint = $"{readyCount}/{members.Count} ready";
            else startHint = isHost ? "Everyone's ready!" : "Waiting for host to start…";

            var footer = new Children
            {
                Btn.Create(label: me is { Ready: true } ? "Not ready" : "I'm ready", variant: me is { Ready: true } ? Btn.Variant.Secondary : Btn.Variant.Primary, action: Lobby.ToggleReady),
            };
            if (isHost) footer.Add(Btn.Create(label: "Start game", disabled: !Lobby.CanStart, action: Lobby.StartGame));

            return Div.Create(className: "screen", children: new Children
            {
                Div.Create(className: "row", children: new Children
                {
                    Btn.Create(label: "Leave room", variant: Btn.Variant.Ghost, small: true, action: Lobby.LeaveRoom),
                }),
                Div.Create(className: "card share-card", children: new Children
                {
                    Label.Create(className: "label-small", text: "ROOM CODE"),
                    Label.Create(className: "room-code", text: room.Code),
                    QrImage.Create(className: "qr", text: Lobby.JoinLink(room.Code)),
                    Label.Create(className: "hint", text: "Friends scan this or enter the code"),
                }),
                Label.Create(className: "section-title", text: $"PLAYERS · {members.Count}"),
                Div.Create(className: "member-list", children: list),
                Label.Create(className: "section-title", text: isHost ? "PICK A GAME" : "GAME"),
                Div.Create(className: "game-list", children: games),
                Div.Create(className: "sticky-footer", children: new Children
                {
                    Label.Create(className: "hint", text: startHint),
                    Div.Create(className: "stack", children: footer),
                }),
            });
        }

        [RequiresManagedContext]
        static Element Playing()
        {
            var room = Lobby.MyRoom;
            var title = Lobby.GameById(room.Game) is { } g ? g.Title : room.Game;
            var children = new Children
            {
                Label.Create(className: "label-small", text: $"ROOM {room.Code}"),
                Label.Create(className: "h1", text: title),
                Label.Create(className: "muted", text: "The game plugs in here."),
            };
            if (Lobby.IsHost) children.Add(Btn.Create(label: "Back to lobby", variant: Btn.Variant.Secondary, action: Lobby.ReturnToLobby));
            else children.Add(Label.Create(className: "hint", text: "The host can send everyone back to the lobby."));
            return Div.Create(className: "screen center", children: children);
        }
    }

    [RishValueType]
    public struct AppRootState
    {
        public uint version;
    }

    public partial class GameCard : RishElement<GameCardProps>
    {
        protected override Element Render()
        {
            var cls = new ClassName { "game-card" };
            if (Props.selected) cls += "selected";
            return AbstractButton.Create(
                interactable: Props.interactable,
                normal: Body(cls),
                pressed: Body(cls + "pressed"),
                disabled: Body(cls + "readonly"),
                action: (Action)Pick);
        }

        [RequiresManagedContext]
        Element Body(ClassName cls) => Div.Create(className: cls, children: new Children
        {
            Div.Create(className: "game-text grow", children: new Children
            {
                Label.Create(className: "game-title", text: Props.title),
                Label.Create(className: "game-blurb", text: Props.blurb),
            }),
            Div.Create(className: Props.selected ? "radio on" : "radio"),
        });

        void Pick() => Props.onPick?.Invoke(Props.gameId);
    }

    [RishValueType]
    public struct GameCardProps
    {
        public RishString title;
        public RishString blurb;
        public RishString gameId;
        public bool selected;
        [DefaultValue(true)] public bool interactable;
        public Action<string> onPick;
    }
}
