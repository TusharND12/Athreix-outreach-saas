export function MeetingSketchIllustration() {
  return (
    <section
      className="meeting-sketch-stage relative mx-auto h-[clamp(20rem,42vh,27rem)] w-full max-w-[76rem] overflow-hidden rounded-[2rem]"
      aria-label="Animated prospect meeting illustration"
    >
      <p className="sr-only">
        A hand-drawn animated scene of a team discussing companies, decision
        makers, and qualified leads around a meeting table.
      </p>
      <svg
        aria-hidden="true"
        className="meeting-sketch-canvas absolute inset-0 size-full"
        viewBox="0 0 1200 430"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter
            id="meeting-pencil-wobble"
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012"
              numOctaves="2"
              seed="8"
              result="paperNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="paperNoise"
              scale="0.7"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <linearGradient id="meeting-table-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#fffdf8" />
            <stop offset="1" stopColor="#eee9df" />
          </linearGradient>
        </defs>

        <g className="meeting-sketch-paper-marks">
          <path d="M38 92c82-53 153-67 226-44" />
          <path d="M947 45c80-28 151-16 212 35" />
          <path d="M73 353c77 27 145 31 208 10" />
          <path d="M926 374c82 20 159 6 223-36" />
          <circle cx="93" cy="178" r="3" />
          <circle cx="1112" cy="208" r="3" />
          <path d="m1070 118 8 8 13-18" />
          <path d="m142 241 9-11 7 13 13-8" />
        </g>

        <g className="meeting-sketch-connections">
          <path
            className="meeting-sketch-connection meeting-sketch-connection-a"
            d="M178 108c29 22 54 39 82 61"
          />
          <path
            className="meeting-sketch-connection meeting-sketch-connection-b"
            d="M1027 115c-33 21-66 37-103 57"
          />
          <path
            className="meeting-sketch-connection meeting-sketch-connection-c"
            d="M285 190c92-17 170 4 251 42"
          />
          <path
            className="meeting-sketch-connection meeting-sketch-connection-d"
            d="M916 190c-92-17-170 4-251 42"
          />
          <path
            className="meeting-sketch-connection meeting-sketch-connection-e"
            d="M395 334c48-31 105-47 168-55"
          />
          <path
            className="meeting-sketch-connection meeting-sketch-connection-f"
            d="M807 334c-49-31-106-47-169-55"
          />
          <path
            className="meeting-sketch-connection meeting-sketch-connection-loop"
            d="M108 210C51 122 231 20 390 47c104-54 316-54 420 0 159-27 339 75 282 163 61 82-78 177-235 153-128 45-386 45-514 0-157 24-296-71-235-153Z"
          />
          <circle cx="260" cy="169" r="4" />
          <circle cx="924" cy="172" r="4" />
          <circle cx="536" cy="232" r="4" />
          <circle cx="665" cy="232" r="4" />
          <circle cx="563" cy="279" r="4" />
          <circle cx="638" cy="279" r="4" />
        </g>

        <g
          className="meeting-sketch-rough"
          filter="url(#meeting-pencil-wobble)"
        >
          <ellipse
            className="meeting-sketch-floor"
            cx="600"
            cy="363"
            rx="430"
            ry="42"
          />

          <g className="meeting-sketch-board">
            <rect x="452" y="25" width="296" height="142" rx="22" />
            <path d="M477 58h99" />
            <path d="M477 75h64" />
            <g className="meeting-sketch-chart">
              <path d="M482 132V96" />
              <path d="M482 132h101" />
              <path d="m494 122 20-17 19 7 28-29 17 10" />
              <circle cx="494" cy="122" r="3" />
              <circle cx="514" cy="105" r="3" />
              <circle cx="533" cy="112" r="3" />
              <circle cx="561" cy="83" r="3" />
              <circle cx="578" cy="93" r="3" />
            </g>
            <g className="meeting-sketch-board-card">
              <rect x="615" y="59" width="102" height="76" rx="12" />
              <circle cx="637" cy="82" r="10" />
              <path d="M630 109h61M630 119h42" />
              <path d="m683 82 7 7 13-17" />
            </g>
          </g>

          <g transform="translate(536 113)">
            <g className="meeting-sketch-person meeting-sketch-presenter">
              <circle
                className="meeting-sketch-skin meeting-sketch-skin-c"
                cx="62"
                cy="39"
                r="27"
              />
              <path
                className="meeting-sketch-hair meeting-sketch-hair-c"
                d="M38 39c-1-23 13-35 31-33 17 2 27 17 21 35-4-10-12-16-23-18-9 9-18 13-29 16Z"
              />
              <path className="meeting-sketch-face" d="M53 43h1m17 0h1" />
              <path className="meeting-sketch-mouth" d="M57 53c4 4 9 4 13 0" />
              <path
                className="meeting-sketch-shirt meeting-sketch-shirt-violet"
                d="M30 157c1-53 7-82 27-91h14c21 9 28 38 30 91Z"
              />
              <path className="meeting-sketch-collar" d="m53 68 11 16 12-16" />
              <g className="meeting-sketch-arm meeting-sketch-arm-presenter">
                <path
                  className="meeting-sketch-skin meeting-sketch-skin-c"
                  d="M92 78c17 8 31 19 40 32l27-31"
                />
                <circle
                  className="meeting-sketch-skin meeting-sketch-skin-c"
                  cx="160"
                  cy="78"
                  r="5"
                />
                <path d="m163 75 8-11m-11 9 3-13" />
              </g>
              <path
                className="meeting-sketch-skin meeting-sketch-skin-c"
                d="M35 79c-16 14-25 30-27 48"
              />
            </g>
          </g>

          <g transform="translate(205 142)">
            <g className="meeting-sketch-person meeting-sketch-person-a">
              <circle
                className="meeting-sketch-skin meeting-sketch-skin-a"
                cx="58"
                cy="38"
                r="26"
              />
              <path
                className="meeting-sketch-hair meeting-sketch-hair-a"
                d="M33 41c-3-23 9-37 26-37 18 0 29 14 27 34-8-12-22-17-35-16-3 9-9 15-18 19Z"
              />
              <path className="meeting-sketch-face" d="M49 43h1m17 0h1" />
              <path className="meeting-sketch-mouth" d="M53 54c4 2 8 2 12-1" />
              <path
                className="meeting-sketch-shirt meeting-sketch-shirt-coral"
                d="M22 150c2-48 11-76 31-84h13c22 9 31 38 34 84Z"
              />
              <path className="meeting-sketch-collar" d="m49 68 10 14 12-14" />
              <g className="meeting-sketch-arm meeting-sketch-arm-left">
                <path
                  className="meeting-sketch-skin meeting-sketch-skin-a"
                  d="M31 79C13 87 2 100-7 117l-20-14"
                />
                <circle
                  className="meeting-sketch-skin meeting-sketch-skin-a"
                  cx="-29"
                  cy="102"
                  r="5"
                />
              </g>
              <path
                className="meeting-sketch-skin meeting-sketch-skin-a"
                d="M91 80c16 11 26 24 30 39"
              />
            </g>
          </g>

          <g transform="translate(857 143)">
            <g className="meeting-sketch-person meeting-sketch-person-b">
              <circle
                className="meeting-sketch-skin meeting-sketch-skin-b"
                cx="58"
                cy="38"
                r="26"
              />
              <path
                className="meeting-sketch-hair meeting-sketch-hair-b"
                d="M32 41C30 16 43 3 61 5c19 2 29 17 24 38-9-8-14-19-15-28-10 14-23 22-38 26Z"
              />
              <path className="meeting-sketch-face" d="M49 43h1m17 0h1" />
              <path className="meeting-sketch-mouth" d="M53 53c4 4 9 4 13 0" />
              <path
                className="meeting-sketch-shirt meeting-sketch-shirt-mint"
                d="M20 150c4-50 13-76 33-84h13c21 9 30 36 33 84Z"
              />
              <path className="meeting-sketch-collar" d="m49 68 10 14 12-14" />
              <g className="meeting-sketch-arm meeting-sketch-arm-right">
                <path
                  className="meeting-sketch-skin meeting-sketch-skin-b"
                  d="M27 82C12 93 5 105 1 121"
                />
              </g>
              <g className="meeting-sketch-arm meeting-sketch-arm-wave">
                <path
                  className="meeting-sketch-skin meeting-sketch-skin-b"
                  d="M91 80c16 5 28 15 37 28l16-26"
                />
                <circle
                  className="meeting-sketch-skin meeting-sketch-skin-b"
                  cx="145"
                  cy="80"
                  r="5"
                />
                <path d="m146 74 4-12m-8 12-1-12" />
              </g>
            </g>
          </g>

          <g className="meeting-sketch-table">
            <path
              fill="url(#meeting-table-fill)"
              d="M265 265c27-39 167-63 335-63s308 24 335 63l-41 76H306Z"
            />
            <ellipse cx="600" cy="267" rx="337" ry="68" />
            <path d="M313 279c174 40 400 40 574 0" />
            <path d="m422 326-13 65m369-65 13 65" />
          </g>

          <g className="meeting-sketch-laptop">
            <path d="m540 221 13-56h98l12 56Z" />
            <path d="M527 222h150l-12 11H540Z" />
            <circle cx="602" cy="194" r="10" />
            <path d="m597 194 4 4 8-10" />
          </g>

          <g className="meeting-sketch-lead-card meeting-sketch-lead-card-a">
            <rect x="379" y="237" width="92" height="57" rx="9" />
            <circle cx="399" cy="257" r="9" />
            <path d="M417 252h36m-36 10h27m-45 17h55" />
          </g>
          <g className="meeting-sketch-lead-card meeting-sketch-lead-card-b">
            <rect x="730" y="236" width="92" height="57" rx="9" />
            <path d="M748 254h51m-51 10h38" />
            <path d="m785 279 7 7 14-19" />
          </g>

          <g transform="translate(347 304)">
            <g className="meeting-sketch-person meeting-sketch-person-d">
              <circle
                className="meeting-sketch-skin meeting-sketch-skin-d"
                cx="48"
                cy="32"
                r="25"
              />
              <path
                className="meeting-sketch-hair meeting-sketch-hair-d"
                d="M24 31C24 10 35-2 51 0c18 2 27 15 22 34-8-12-18-17-31-17-4 8-10 12-18 14Z"
              />
              <path className="meeting-sketch-face" d="M40 36h1m16 0h1" />
              <path
                className="meeting-sketch-shirt meeting-sketch-shirt-ink"
                d="M7 126c3-42 14-66 35-72h13c23 7 35 32 39 72Z"
              />
            </g>
          </g>

          <g transform="translate(759 304)">
            <g className="meeting-sketch-person meeting-sketch-person-e">
              <circle
                className="meeting-sketch-skin meeting-sketch-skin-e"
                cx="48"
                cy="32"
                r="25"
              />
              <path
                className="meeting-sketch-hair meeting-sketch-hair-e"
                d="M23 34C18 14 32-1 50 0c19 1 30 18 23 38-4-10-14-19-26-22-5 10-13 16-24 18Z"
              />
              <path className="meeting-sketch-face" d="M40 36h1m16 0h1" />
              <path
                className="meeting-sketch-shirt meeting-sketch-shirt-violet"
                d="M4 126c5-43 16-65 38-72h13c22 8 33 31 38 72Z"
              />
            </g>
          </g>

          <g className="meeting-sketch-bubble meeting-sketch-bubble-left">
            <path d="M91 69c0-22 18-39 40-39h109c22 0 40 17 40 39s-18 39-40 39h-62l-25 22 4-22h-26c-22 0-40-17-40-39Z" />
            <circle
              className="meeting-sketch-speech-dot"
              cx="151"
              cy="69"
              r="5"
            />
            <circle
              className="meeting-sketch-speech-dot meeting-sketch-speech-dot-b"
              cx="176"
              cy="69"
              r="5"
            />
            <circle
              className="meeting-sketch-speech-dot meeting-sketch-speech-dot-c"
              cx="201"
              cy="69"
              r="5"
            />
          </g>

          <g className="meeting-sketch-bubble meeting-sketch-bubble-right">
            <path d="M924 76c0-22 18-39 40-39h123c22 0 40 17 40 39s-18 39-40 39h-34l5 21-27-21h-67c-22 0-40-17-40-39Z" />
            <rect x="955" y="62" width="24" height="23" rx="5" />
            <path d="M990 82V65m14 17V56m14 26V71m14 11V61" />
            <path d="m1056 73 8 8 15-20" />
          </g>

          <g className="meeting-sketch-reaction meeting-sketch-reaction-a">
            <path d="m795 90 5-13 5 13 13 5-13 5-5 13-5-13-13-5Z" />
          </g>
          <g className="meeting-sketch-reaction meeting-sketch-reaction-b">
            <path d="M387 109c-10-14-29-1-20 13l20 24 20-24c9-14-10-27-20-13Z" />
          </g>
        </g>
      </svg>
    </section>
  );
}
