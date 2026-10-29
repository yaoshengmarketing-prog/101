/* Fixed historical preview fixture. testOnly is artificial and excluded from formal data. */
window.PREVIEW_DATA = {
  "meta": {
    "label": "2026 世界大賽 G5｜固定歷史資料",
    "snapshotCommit": "72070a33db4e5bd51ec2763cdcdfbea77368cd79",
    "gamePk": 849799,
    "twDate": "2026-10-29",
    "usDate": "2026-10-28",
    "sourceFiles": [
      "live/data/games/849799.json",
      "live/data/ctx/849799.json",
      "live/data/bullpen/849799.json",
      "live/data/roster/849799.json",
      "live/data/manifest.json"
    ],
    "mode": "歷史回放，非即時資料"
  },
  "game": {
    "pk": 849799,
    "twDate": "2026-10-29",
    "usDate": "2026-10-28",
    "startUTC": "2026-10-29T00:00:00Z",
    "twTime": "08:00",
    "venue": "Tropicana Field",
    "series": {
      "desc": "World Series",
      "n": 5,
      "of": 7
    },
    "away": {
      "id": 158,
      "ab": "MIL",
      "name": "釀酒人",
      "rec": "103-59",
      "l10": "8-2",
      "sp": {
        "id": 694819,
        "name": "Jacob Misiorowski",
        "hand": "R",
        "era": "1.80",
        "whip": "0.80",
        "ip": "174.2",
        "gs": 30
      },
      "lineup": {
        "state": "official",
        "firstSeen": "2026-10-28T20:30:41.051Z",
        "slots": [
          {
            "n": 1,
            "id": 694192,
            "name": "Jackson Chourio",
            "pos": "LF",
            "avg": ".291",
            "ops": ".838"
          },
          {
            "n": 2,
            "id": 641343,
            "name": "Jake Bauers",
            "pos": "1B",
            "avg": ".266",
            "ops": ".873"
          },
          {
            "n": 3,
            "id": 592885,
            "name": "Christian Yelich",
            "pos": "DH",
            "avg": ".235",
            "ops": ".693"
          },
          {
            "n": 4,
            "id": 661388,
            "name": "William Contreras",
            "pos": "C",
            "avg": ".270",
            "ops": ".758"
          },
          {
            "n": 5,
            "id": 668930,
            "name": "Brice Turang",
            "pos": "2B",
            "avg": ".268",
            "ops": ".816"
          },
          {
            "n": 6,
            "id": 686217,
            "name": "Sal Frelick",
            "pos": "RF",
            "avg": ".230",
            "ops": ".614"
          },
          {
            "n": 7,
            "id": 806198,
            "name": "Cooper Pratt",
            "pos": "SS",
            "avg": ".281",
            "ops": ".718"
          },
          {
            "n": 8,
            "id": 669003,
            "name": "Garrett Mitchell",
            "pos": "CF",
            "avg": ".262",
            "ops": ".770"
          },
          {
            "n": 9,
            "id": 666152,
            "name": "David Hamilton",
            "pos": "3B",
            "avg": ".245",
            "ops": ".650"
          }
        ]
      }
    },
    "home": {
      "id": 139,
      "ab": "TB",
      "name": "光芒",
      "rec": "98-64",
      "l10": "5-5",
      "sp": {
        "id": 656876,
        "name": "Drew Rasmussen",
        "hand": "R",
        "era": "2.67",
        "whip": "0.91",
        "ip": "172.0",
        "gs": 30
      },
      "lineup": {
        "state": "official",
        "firstSeen": "2026-10-28T20:00:51.705Z",
        "slots": [
          {
            "n": 1,
            "id": 650490,
            "name": "Yandy Díaz",
            "pos": "DH",
            "avg": ".293",
            "ops": ".805"
          },
          {
            "n": 2,
            "id": 666018,
            "name": "Jonathan Aranda",
            "pos": "1B",
            "avg": ".274",
            "ops": ".792"
          },
          {
            "n": 3,
            "id": 691406,
            "name": "Junior Caminero",
            "pos": "3B",
            "avg": ".276",
            "ops": ".884"
          },
          {
            "n": 4,
            "id": 689414,
            "name": "Liam Hicks",
            "pos": "C",
            "avg": ".284",
            "ops": ".801"
          },
          {
            "n": 5,
            "id": 676356,
            "name": "Jonny DeLuca",
            "pos": "CF",
            "avg": ".266",
            "ops": ".729"
          },
          {
            "n": 6,
            "id": 802415,
            "name": "Chandler Simpson",
            "pos": "LF",
            "avg": ".306",
            "ops": ".689"
          },
          {
            "n": 7,
            "id": 810938,
            "name": "Ben Williamson",
            "pos": "2B",
            "avg": ".238",
            "ops": ".620"
          },
          {
            "n": 8,
            "id": 668723,
            "name": "Ryan Vilade",
            "pos": "RF",
            "avg": ".245",
            "ops": ".750"
          },
          {
            "n": 9,
            "id": 670764,
            "name": "Taylor Walls",
            "pos": "SS",
            "avg": ".222",
            "ops": ".607"
          }
        ]
      }
    }
  },
  "context": [
    {
      "id": "bp_streak",
      "title": "中繼連續登板",
      "threshold": "一方有 ≥ 2 位中繼連續 2 天以上登板（到本場之前）",
      "value": "釀酒人 1 位／光芒 2 位",
      "says": [
        "釀酒人：Antonio Senzatela 連 2 天；光芒：Tyler Wells 連 2 天、Cam Booser 連 2 天。",
        "連投不等於今天不能上，只是列出來一起看。"
      ],
      "similar": {
        "n": 4,
        "byType": {
          "R": 2,
          "post": 2,
          "unknown": 0
        }
      }
    },
    {
      "id": "whip",
      "title": "兩名先發 WHIP 都在 1.00 以下",
      "threshold": "雙方先發本季 WHIP 皆 < 1.00 且局數皆 ≥ 100",
      "value": "0.80 / 0.91（局數 174.2 / 172.0）",
      "says": [
        "分母＝本季大聯盟出賽（30 先發 174.2 局／30 先發 172.0 局）。",
        "沒有對左右打拆分與近幾場逐場，這張卡不做今天的對位判斷。"
      ],
      "similar": {
        "n": 2,
        "byType": {
          "R": 0,
          "post": 2,
          "unknown": 0
        }
      }
    },
    {
      "id": "l10",
      "title": "近十場差距",
      "threshold": "一方近十場勝率 ≥ .700 且雙方差 ≥ .200",
      "value": "8-2（.800）vs 5-5（.500）＝ 差 .300",
      "says": [
        "分母只有 10 場，這個數字不拿來推論今天誰會贏。"
      ],
      "similar": {
        "n": 26,
        "byType": {
          "R": 8,
          "post": 18,
          "unknown": 0
        }
      }
    },
    {
      "id": "home",
      "title": "主隊主場戰績",
      "threshold": "主隊主場勝率 ≥ .650",
      "value": "光芒主場 55-26（.679）",
      "says": [
        "光芒本季主場 81 場贏 55 場。"
      ],
      "similar": {
        "n": 15,
        "byType": {
          "R": 2,
          "post": 13,
          "unknown": 0
        }
      }
    }
  ],
  "bullpen": {
    "away": {
      "days": [
        {
          "date": "2026-10-25",
          "state": "off",
          "complete": false,
          "pitches": null,
          "apps": 0,
          "pitchers": 0
        },
        {
          "date": "2026-10-26",
          "state": "played",
          "complete": true,
          "pitches": 44,
          "apps": 2,
          "pitchers": 2
        },
        {
          "date": "2026-10-27",
          "state": "played",
          "complete": true,
          "pitches": 123,
          "apps": 7,
          "pitchers": 7
        },
        {
          "date": "2026-10-28",
          "state": "off",
          "complete": false,
          "pitches": null,
          "apps": 0,
          "pitchers": 0
        }
      ],
      "top": [
        {
          "id": 622608,
          "name": "Antonio Senzatela",
          "total": 44,
          "last": "2026-10-27"
        },
        {
          "id": 676879,
          "name": "Aaron Ashby",
          "total": 31,
          "last": "2026-10-27"
        },
        {
          "id": 669084,
          "name": "DL Hall",
          "total": 24,
          "last": "2026-10-27"
        }
      ],
      "pitchers": [
        {
          "id": 622608,
          "name": "Antonio Senzatela",
          "total": 44,
          "streak": 2,
          "days": {
            "2026-10-26": {
              "pitches": 26,
              "apps": 1
            },
            "2026-10-27": {
              "pitches": 18,
              "apps": 1
            }
          }
        },
        {
          "id": 676879,
          "name": "Aaron Ashby",
          "total": 31,
          "streak": 1,
          "days": {
            "2026-10-27": {
              "pitches": 31,
              "apps": 1
            }
          }
        },
        {
          "id": 669084,
          "name": "DL Hall",
          "total": 24,
          "streak": 1,
          "days": {
            "2026-10-27": {
              "pitches": 24,
              "apps": 1
            }
          }
        },
        {
          "id": 682842,
          "name": "Abner Uribe",
          "total": 19,
          "streak": 1,
          "days": {
            "2026-10-27": {
              "pitches": 19,
              "apps": 1
            }
          }
        },
        {
          "id": 675660,
          "name": "Shane Drohan",
          "total": 15,
          "streak": 1,
          "days": {
            "2026-10-27": {
              "pitches": 15,
              "apps": 1
            }
          }
        },
        {
          "id": 668941,
          "name": "JoJo Romero",
          "total": 11,
          "streak": 1,
          "days": {
            "2026-10-27": {
              "pitches": 11,
              "apps": 1
            }
          }
        },
        {
          "id": 656730,
          "name": "Trevor Megill",
          "total": 5,
          "streak": 1,
          "days": {
            "2026-10-27": {
              "pitches": 5,
              "apps": 1
            }
          }
        },
        {
          "id": 605540,
          "name": "Brandon Woodruff",
          "total": 18,
          "streak": 0,
          "days": {
            "2026-10-26": {
              "pitches": 18,
              "apps": 1
            }
          }
        }
      ]
    },
    "home": {
      "days": [
        {
          "date": "2026-10-25",
          "state": "off",
          "complete": false,
          "pitches": null,
          "apps": 0,
          "pitchers": 0
        },
        {
          "date": "2026-10-26",
          "state": "played",
          "complete": true,
          "pitches": 88,
          "apps": 5,
          "pitchers": 5
        },
        {
          "date": "2026-10-27",
          "state": "played",
          "complete": true,
          "pitches": 131,
          "apps": 6,
          "pitchers": 6
        },
        {
          "date": "2026-10-28",
          "state": "off",
          "complete": false,
          "pitches": null,
          "apps": 0,
          "pitchers": 0
        }
      ],
      "top": [
        {
          "id": 669330,
          "name": "Tyler Wells",
          "total": 40,
          "last": "2026-10-27"
        },
        {
          "id": 592155,
          "name": "Cam Booser",
          "total": 21,
          "last": "2026-10-27"
        },
        {
          "id": 607259,
          "name": "Nick Martinez",
          "total": 33,
          "last": "2026-10-27"
        }
      ],
      "pitchers": [
        {
          "id": 669330,
          "name": "Tyler Wells",
          "total": 40,
          "streak": 2,
          "days": {
            "2026-10-26": {
              "pitches": 16,
              "apps": 1
            },
            "2026-10-27": {
              "pitches": 24,
              "apps": 1
            }
          }
        },
        {
          "id": 592155,
          "name": "Cam Booser",
          "total": 21,
          "streak": 2,
          "days": {
            "2026-10-26": {
              "pitches": 12,
              "apps": 1
            },
            "2026-10-27": {
              "pitches": 9,
              "apps": 1
            }
          }
        },
        {
          "id": 607259,
          "name": "Nick Martinez",
          "total": 33,
          "streak": 1,
          "days": {
            "2026-10-27": {
              "pitches": 33,
              "apps": 1
            }
          }
        },
        {
          "id": 693855,
          "name": "Ian Seymour",
          "total": 32,
          "streak": 1,
          "days": {
            "2026-10-27": {
              "pitches": 32,
              "apps": 1
            }
          }
        },
        {
          "id": 641329,
          "name": "Bryan Baker",
          "total": 21,
          "streak": 1,
          "days": {
            "2026-10-27": {
              "pitches": 21,
              "apps": 1
            }
          }
        },
        {
          "id": 687330,
          "name": "Kevin Kelly",
          "total": 12,
          "streak": 1,
          "days": {
            "2026-10-27": {
              "pitches": 12,
              "apps": 1
            }
          }
        },
        {
          "id": 642121,
          "name": "Cole Sulser",
          "total": 32,
          "streak": 0,
          "days": {
            "2026-10-26": {
              "pitches": 32,
              "apps": 1
            }
          }
        },
        {
          "id": 571927,
          "name": "Steven Matz",
          "total": 17,
          "streak": 0,
          "days": {
            "2026-10-26": {
              "pitches": 17,
              "apps": 1
            }
          }
        },
        {
          "id": 664076,
          "name": "Garrett Cleavinger",
          "total": 11,
          "streak": 0,
          "days": {
            "2026-10-26": {
              "pitches": 11,
              "apps": 1
            }
          }
        }
      ]
    },
    "window": {
      "full": [
        "2026-10-25",
        "2026-10-26",
        "2026-10-27"
      ],
      "today": "2026-10-28",
      "officialDate": "2026-10-28"
    }
  },
  "roster": {
    "away": {
      "basis": "本系列第 4 戰（10/27）比賽日的現役名單",
      "changes": [
        {
          "id": 605540,
          "name": "Brandon Woodruff",
          "group": "ilMove"
        }
      ]
    },
    "home": {
      "basis": "本系列第 4 戰（10/27）比賽日的現役名單",
      "changes": []
    }
  },
  "weather": {
    "condition": "Dome",
    "tempF": 72,
    "wind": "0 mph, None"
  },
  "post": {
    "complete": true,
    "fetchedAt": "2026-10-29T03:15:59.887Z",
    "final": {
      "away": {
        "runs": 4,
        "hits": 8,
        "errors": 2
      },
      "home": {
        "runs": 1,
        "hits": 4,
        "errors": 0
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
        "away": 1,
        "home": 0
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
        "away": 1,
        "home": 0
      },
      {
        "n": 6,
        "away": 2,
        "home": 0
      },
      {
        "n": 7,
        "away": 0,
        "home": 0
      },
      {
        "n": 8,
        "away": 0,
        "home": 0
      },
      {
        "n": 9,
        "away": 0,
        "home": 1
      }
    ],
    "pitching": {
      "away": {
        "sp": {
          "id": 694819,
          "name": "Jacob Misiorowski",
          "role": "SP",
          "outs": 17,
          "pitches": 86,
          "runs": 0,
          "er": 0
        },
        "rp": {
          "apps": 3,
          "pitches": 49,
          "noCount": 0,
          "outs": 10,
          "runs": 1,
          "er": 1,
          "pitchers": [
            {
              "id": 668941,
              "name": "JoJo Romero",
              "role": "RP",
              "outs": 2,
              "pitches": 10,
              "runs": 0,
              "er": 0
            },
            {
              "id": 682842,
              "name": "Abner Uribe",
              "role": "RP",
              "outs": 2,
              "pitches": 10,
              "runs": 0,
              "er": 0
            },
            {
              "id": 656730,
              "name": "Trevor Megill",
              "role": "RP",
              "outs": 6,
              "pitches": 29,
              "runs": 1,
              "er": 1
            }
          ]
        }
      },
      "home": {
        "sp": {
          "id": 656876,
          "name": "Drew Rasmussen",
          "role": "SP",
          "outs": 12,
          "pitches": 48,
          "runs": 1,
          "er": 1
        },
        "rp": {
          "apps": 6,
          "pitches": 72,
          "noCount": 0,
          "outs": 15,
          "runs": 3,
          "er": 3,
          "pitchers": [
            {
              "id": 687330,
              "name": "Kevin Kelly",
              "role": "RP",
              "outs": 2,
              "pitches": 17,
              "runs": 1,
              "er": 1
            },
            {
              "id": 664076,
              "name": "Garrett Cleavinger",
              "role": "RP",
              "outs": 1,
              "pitches": 8,
              "runs": 2,
              "er": 2
            },
            {
              "id": 669330,
              "name": "Tyler Wells",
              "role": "RP",
              "outs": 2,
              "pitches": 14,
              "runs": 0,
              "er": 0
            },
            {
              "id": 571927,
              "name": "Steven Matz",
              "role": "RP",
              "outs": 4,
              "pitches": 18,
              "runs": 0,
              "er": 0
            },
            {
              "id": 641329,
              "name": "Bryan Baker",
              "role": "RP",
              "outs": 3,
              "pitches": 7,
              "runs": 0,
              "er": 0
            },
            {
              "id": 693855,
              "name": "Ian Seymour",
              "role": "RP",
              "outs": 3,
              "pitches": 8,
              "runs": 0,
              "er": 0
            }
          ]
        }
      }
    }
  },
  "recent": [
    {
      "pk": 849799,
      "twDate": "2026-10-29",
      "gameType": "W",
      "away": {
        "ab": "MIL",
        "name": "釀酒人",
        "score": 4
      },
      "home": {
        "ab": "TB",
        "name": "光芒",
        "score": 1
      }
    },
    {
      "pk": 849803,
      "twDate": "2026-10-28",
      "gameType": "W",
      "away": {
        "ab": "MIL",
        "name": "釀酒人",
        "score": 3
      },
      "home": {
        "ab": "TB",
        "name": "光芒",
        "score": 4
      }
    },
    {
      "pk": 849804,
      "twDate": "2026-10-27",
      "gameType": "W",
      "away": {
        "ab": "MIL",
        "name": "釀酒人",
        "score": 10
      },
      "home": {
        "ab": "TB",
        "name": "光芒",
        "score": 1
      }
    },
    {
      "pk": 849802,
      "twDate": "2026-10-25",
      "gameType": "W",
      "away": {
        "ab": "TB",
        "name": "光芒",
        "score": 4
      },
      "home": {
        "ab": "MIL",
        "name": "釀酒人",
        "score": 5
      }
    },
    {
      "pk": 849805,
      "twDate": "2026-10-24",
      "gameType": "W",
      "away": {
        "ab": "TB",
        "name": "光芒",
        "score": 2
      },
      "home": {
        "ab": "MIL",
        "name": "釀酒人",
        "score": 3
      }
    },
    {
      "pk": 849815,
      "twDate": "2026-10-20",
      "gameType": "L",
      "away": {
        "ab": "CLE",
        "name": "守護者",
        "score": 3
      },
      "home": {
        "ab": "TB",
        "name": "光芒",
        "score": 7
      }
    },
    {
      "pk": 849817,
      "twDate": "2026-10-19",
      "gameType": "L",
      "away": {
        "ab": "TB",
        "name": "光芒",
        "score": 3
      },
      "home": {
        "ab": "CLE",
        "name": "守護者",
        "score": 1
      }
    },
    {
      "pk": 849816,
      "twDate": "2026-10-18",
      "gameType": "L",
      "away": {
        "ab": "TB",
        "name": "光芒",
        "score": 7
      },
      "home": {
        "ab": "CLE",
        "name": "守護者",
        "score": 3
      }
    },
    {
      "pk": 849810,
      "twDate": "2026-10-16",
      "gameType": "L",
      "away": {
        "ab": "MIL",
        "name": "釀酒人",
        "score": 6
      },
      "home": {
        "ab": "LAD",
        "name": "道奇",
        "score": 4
      }
    },
    {
      "pk": 849818,
      "twDate": "2026-10-16",
      "gameType": "L",
      "away": {
        "ab": "TB",
        "name": "光芒",
        "score": 2
      },
      "home": {
        "ab": "CLE",
        "name": "守護者",
        "score": 3
      }
    }
  ],
  "matchup": [
    {
      "pitcherSide": "away",
      "battingSide": "home",
      "starterHand": "R",
      "pitcher": "Jacob Misiorowski",
      "batting": "光芒",
      "splitScope": "2026 例行賽",
      "splits": {
        "vl": {
          "ops": ".378",
          "pa": 366
        },
        "vr": {
          "ops": ".582",
          "pa": 299
        }
      },
      "recent": [
        {
          "date": "2026-10-03",
          "gameType": "D",
          "opp": "教士",
          "ha": "主",
          "ip": "4.0",
          "np": 88,
          "er": 2
        },
        {
          "date": "2026-10-11",
          "gameType": "L",
          "opp": "道奇",
          "ha": "主",
          "ip": "4.1",
          "np": 94,
          "er": 1
        },
        {
          "date": "2026-10-23",
          "gameType": "W",
          "opp": "光芒",
          "ha": "主",
          "ip": "5.0",
          "np": 78,
          "er": 1
        }
      ],
      "lineup": [
        {
          "n": 1,
          "id": 650490,
          "name": "Yandy Díaz",
          "bats": "R",
          "vs": {
            "pa": 484,
            "avg": ".305",
            "ops": ".816"
          }
        },
        {
          "n": 2,
          "id": 666018,
          "name": "Jonathan Aranda",
          "bats": "L",
          "vs": {
            "pa": 478,
            "avg": ".284",
            "ops": ".837"
          }
        },
        {
          "n": 3,
          "id": 691406,
          "name": "Junior Caminero",
          "bats": "R",
          "vs": {
            "pa": 507,
            "avg": ".272",
            "ops": ".871"
          }
        },
        {
          "n": 4,
          "id": 689414,
          "name": "Liam Hicks",
          "bats": "L",
          "vs": {
            "pa": 436,
            "avg": ".309",
            "ops": ".883"
          }
        },
        {
          "n": 5,
          "id": 676356,
          "name": "Jonny DeLuca",
          "bats": "R",
          "vs": {
            "pa": 215,
            "avg": ".267",
            "ops": ".773"
          }
        },
        {
          "n": 6,
          "id": 802415,
          "name": "Chandler Simpson",
          "bats": "L",
          "vs": {
            "pa": 401,
            "avg": ".318",
            "ops": ".718"
          }
        },
        {
          "n": 7,
          "id": 810938,
          "name": "Ben Williamson",
          "bats": "R",
          "vs": {
            "pa": 153,
            "avg": ".250",
            "ops": ".649"
          }
        },
        {
          "n": 8,
          "id": 668723,
          "name": "Ryan Vilade",
          "bats": "R",
          "vs": {
            "pa": 108,
            "avg": ".202",
            "ops": ".641"
          }
        },
        {
          "n": 9,
          "id": 670764,
          "name": "Taylor Walls",
          "bats": "S",
          "vs": {
            "pa": 278,
            "avg": ".233",
            "ops": ".644"
          }
        }
      ]
    },
    {
      "pitcherSide": "home",
      "battingSide": "away",
      "starterHand": "R",
      "pitcher": "Drew Rasmussen",
      "batting": "釀酒人",
      "splitScope": "2026 例行賽",
      "splits": {
        "vl": {
          "ops": ".568",
          "pa": 392
        },
        "vr": {
          "ops": ".510",
          "pa": 277
        }
      },
      "recent": [
        {
          "date": "2026-10-12",
          "gameType": "L",
          "opp": "守護者",
          "ha": "主",
          "ip": "6.0",
          "np": 91,
          "er": 2
        },
        {
          "date": "2026-10-18",
          "gameType": "L",
          "opp": "守護者",
          "ha": "客",
          "ip": "7.0",
          "np": 95,
          "er": 1
        },
        {
          "date": "2026-10-24",
          "gameType": "W",
          "opp": "釀酒人",
          "ha": "客",
          "ip": "3.2",
          "np": 89,
          "er": 3
        }
      ],
      "lineup": [
        {
          "n": 1,
          "id": 694192,
          "name": "Jackson Chourio",
          "bats": "R",
          "vs": {
            "pa": 402,
            "avg": ".274",
            "ops": ".778"
          }
        },
        {
          "n": 2,
          "id": 641343,
          "name": "Jake Bauers",
          "bats": "L",
          "vs": {
            "pa": 418,
            "avg": ".266",
            "ops": ".863"
          }
        },
        {
          "n": 3,
          "id": 592885,
          "name": "Christian Yelich",
          "bats": "L",
          "vs": {
            "pa": 370,
            "avg": ".244",
            "ops": ".722"
          }
        },
        {
          "n": 4,
          "id": 661388,
          "name": "William Contreras",
          "bats": "R",
          "vs": {
            "pa": 457,
            "avg": ".270",
            "ops": ".757"
          }
        },
        {
          "n": 5,
          "id": 668930,
          "name": "Brice Turang",
          "bats": "L",
          "vs": {
            "pa": 478,
            "avg": ".291",
            "ops": ".901"
          }
        },
        {
          "n": 6,
          "id": 686217,
          "name": "Sal Frelick",
          "bats": "L",
          "vs": {
            "pa": 286,
            "avg": ".239",
            "ops": ".640"
          }
        },
        {
          "n": 7,
          "id": 806198,
          "name": "Cooper Pratt",
          "bats": "R",
          "vs": {
            "pa": 196,
            "avg": ".306",
            "ops": ".768"
          }
        },
        {
          "n": 8,
          "id": 669003,
          "name": "Garrett Mitchell",
          "bats": "L",
          "vs": {
            "pa": 402,
            "avg": ".271",
            "ops": ".802"
          }
        },
        {
          "n": 9,
          "id": 666152,
          "name": "David Hamilton",
          "bats": "L",
          "vs": {
            "pa": 306,
            "avg": ".250",
            "ops": ".668"
          }
        }
      ]
    }
  ],
  "testOnly": {
    "description": "人工版型測試，不是真實賽事或研究樣本",
    "small": {
      "pitchers": {
        "away": {
          "ip": "3.2",
          "outs": 11,
          "er": 2,
          "h": 3,
          "bb": 2,
          "era": "4.91",
          "whip": "1.36"
        },
        "home": {
          "ip": "8.0",
          "outs": 24,
          "er": 2,
          "h": 6,
          "bb": 1,
          "era": "2.25",
          "whip": "0.88"
        }
      },
      "hitters": {
        "away": {
          "pa": 7,
          "ab": 6,
          "h": 2,
          "bb": 1,
          "tb": 2,
          "obp": ".429",
          "slg": ".333",
          "ops": ".762"
        },
        "home": {
          "pa": 12,
          "ab": 11,
          "h": 3,
          "bb": 1,
          "tb": 5,
          "obp": ".333",
          "slg": ".455",
          "ops": ".788"
        },
        "validZero": {
          "pa": 5,
          "ab": 5,
          "h": 0,
          "bb": 0,
          "tb": 0,
          "ops": ".000"
        }
      }
    },
    "bullpenMissing": {
      "description": "人工假設 MIL 10/27 的 DL Hall 用球未取得；其餘沿用固定歷史資料。不得當成真實缺漏。",
      "side": "away",
      "date": "2026-10-27",
      "pitcherId": 669084
    }
  }
};
