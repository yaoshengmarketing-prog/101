/* 精簡固定回查資料；不代表賽前快照或 2027 來源驗證。 */
window.SPRING_PREVIEW_DATA = {
  "meta": {
    "status": "完賽後回查的歷史資料",
    "retrievedAt": "2026-10-29T19:25:48Z",
    "pregameAvailability": "未驗證當時賽前何時取得；不是賽前快照",
    "sources": {
      "schedule": "https://statsapi.mlb.com/api/v1/schedule?sportId=1&gamePks=832077&hydrate=probablePitcher,linescore,venue(timezone),team,weather",
      "boxscore": "https://statsapi.mlb.com/api/v1/game/832077/boxscore"
    },
    "selection": "只抽取春訓完賽回放所需欄位；原始先發九棒取 boxscore players[].battingOrder 為 100、200…900 者；不使用賽後 teams.battingOrder 最後在場者"
  },
  "game": {
    "pk": 832077,
    "gameType": "S",
    "usDate": "2026-03-24",
    "twDate": "2026-03-25",
    "startUTC": "2026-03-24T21:10:00Z",
    "twTime": "05:10",
    "venue": "American Family Field",
    "status": "Final",
    "scheduledInnings": 9,
    "away": {
      "id": 113,
      "ab": "CIN",
      "name": "紅人",
      "en": "Cincinnati Reds",
      "score": 1,
      "probableAfterFinal": "Chase Burns"
    },
    "home": {
      "id": 158,
      "ab": "MIL",
      "name": "釀酒人",
      "en": "Milwaukee Brewers",
      "score": 4,
      "probableAfterFinal": "Brandon Sproat"
    }
  },
  "innings": [
    {
      "n": 1,
      "away": 0,
      "home": 0
    },
    {
      "n": 2,
      "away": 0,
      "home": 1
    },
    {
      "n": 3,
      "away": 0,
      "home": 0
    },
    {
      "n": 4,
      "away": 0,
      "home": 0
    },
    {
      "n": 5,
      "away": 0,
      "home": 1
    },
    {
      "n": 6,
      "away": 1,
      "home": 0
    },
    {
      "n": 7,
      "away": 0,
      "home": 2
    },
    {
      "n": 8,
      "away": 0,
      "home": 0
    },
    {
      "n": 9,
      "away": 0,
      "home": null
    }
  ],
  "lineups": {
    "away": [
      {
        "n": 1,
        "id": 670770,
        "name": "TJ Friedl",
        "pos": "CF"
      },
      {
        "n": 2,
        "id": 680574,
        "name": "Matt McLain",
        "pos": "2B"
      },
      {
        "n": 3,
        "id": 682829,
        "name": "Elly De La Cruz",
        "pos": "SS"
      },
      {
        "n": 4,
        "id": 701398,
        "name": "Sal Stewart",
        "pos": "1B"
      },
      {
        "n": 5,
        "id": 553993,
        "name": "Eugenio Suárez",
        "pos": "DH"
      },
      {
        "n": 6,
        "id": 668715,
        "name": "Spencer Steer",
        "pos": "RF"
      },
      {
        "n": 7,
        "id": 666181,
        "name": "Will Benson",
        "pos": "LF"
      },
      {
        "n": 8,
        "id": 663886,
        "name": "Tyler Stephenson",
        "pos": "C"
      },
      {
        "n": 9,
        "id": 663647,
        "name": "Ke'Bryan Hayes",
        "pos": "3B"
      }
    ],
    "home": [
      {
        "n": 1,
        "id": 694192,
        "name": "Jackson Chourio",
        "pos": "CF"
      },
      {
        "n": 2,
        "id": 668930,
        "name": "Brice Turang",
        "pos": "2B"
      },
      {
        "n": 3,
        "id": 661388,
        "name": "William Contreras",
        "pos": "C"
      },
      {
        "n": 4,
        "id": 592885,
        "name": "Christian Yelich",
        "pos": "DH"
      },
      {
        "n": 5,
        "id": 683734,
        "name": "Andrew Vaughn",
        "pos": "1B"
      },
      {
        "n": 6,
        "id": 641343,
        "name": "Jake Bauers",
        "pos": "LF"
      },
      {
        "n": 7,
        "id": 686217,
        "name": "Sal Frelick",
        "pos": "RF"
      },
      {
        "n": 8,
        "id": 666152,
        "name": "David Hamilton",
        "pos": "3B"
      },
      {
        "n": 9,
        "id": 687401,
        "name": "Joey Ortiz",
        "pos": "SS"
      }
    ]
  },
  "pitchers": {
    "away": [
      {
        "id": 695505,
        "name": "Chase Burns",
        "ip": "5.0",
        "pitches": 68
      },
      {
        "id": 695076,
        "name": "Rhett Lowder",
        "ip": "3.0",
        "pitches": 50
      }
    ],
    "home": [
      {
        "id": 687075,
        "name": "Brandon Sproat",
        "ip": "4.0",
        "pitches": 62
      },
      {
        "id": 690986,
        "name": "Kyle Harrison",
        "ip": "4.1",
        "pitches": 82
      },
      {
        "id": 702153,
        "name": "Brian Fitzpatrick",
        "ip": "0.2",
        "pitches": 9
      }
    ]
  }
};

