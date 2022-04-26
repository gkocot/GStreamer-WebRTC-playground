# cd ~/gstreamer/subprojects/gst-examples/webrtc/sendrecv/gst/
# docker build -t ubuntu-dev-gstreamer .
# docker run -dit -v $(pwd)/tutorials:/tutorials --network host --name mydev ubuntu-dev-gstreamer
FROM ubuntu:20.04

# tzdata hangs during Docker image build, workaround
# https://dev.to/grigorkh/fix-tzdata-hangs-during-docker-image-build-4o9m
ENV TZ=Europe/Warsaw
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apt-get update && apt-get install -y --no-install-recommends \
    bison \
    build-essential \
    ca-certificates \
    coreutils \
    flex \
    git \
    libjson-glib-dev \
    libopus-dev \
    libpango1.0-dev \
    libsoup2.4-dev \
    libsrtp2-dev \
    libssh-dev \
    libvpx-dev \
    ninja-build \
    python3-pip \
    wget

RUN apt-get update && apt-get install -y --no-install-recommends \
    libavfilter-dev \
    libx264-dev

RUN pip3 install meson

WORKDIR /usr/local/src
RUN git clone https://gitlab.freedesktop.org/gstreamer/gstreamer.git

    # gstreamer
    # https://www.linuxfromscratch.org/blfs/view/svn/multimedia/gstreamer10.html
WORKDIR /usr/local/src/gstreamer/subprojects/gstreamer
RUN mkdir build \
    && cd build \
    # && meson --prefix=/usr --buildtype=release -Dgst_debug=false -Dpackage-origin=https://gitlab.freedesktop.org/gstreamer/gstreamer -Dpackage-name="GStreamer $(date)" \
    && meson --prefix=/usr --buildtype=release -Dpackage-origin=https://gitlab.freedesktop.org/gstreamer/gstreamer -Dpackage-name="GStreamer $(date)" | tee build.log \
    && ninja \
    && ninja install

    # libnice
    # https://www.linuxfromscratch.org/blfs/view/7.6/basicnet/libnice.html
WORKDIR /usr/local/src
RUN wget https://libnice.freedesktop.org/releases/libnice-0.1.18.tar.gz \
    && tar -xvzf libnice-0.1.18.tar.gz \
    && cd libnice-0.1.18 \
    && mkdir build \
    && cd build \
    && meson --prefix=/usr --buildtype=release | tee build.log \
    && ninja \
    && ninja install
    
    # gst-plugins-base
WORKDIR /usr/local/src/gstreamer/subprojects/gst-plugins-base
RUN mkdir build \
    && cd build \
    && meson --prefix=/usr --buildtype=release -Dpackage-origin=https://gitlab.freedesktop.org/gstreamer/gstreamer -Dpackage-name="GStreamer $(date)" | tee build.log \
    && ninja \
    && ninja install

    # gst-plugins-good
WORKDIR /usr/local/src/gstreamer/subprojects/gst-plugins-good
RUN mkdir build \
    && cd build \
    && meson --prefix=/usr --buildtype=release -Dpackage-origin=https://gitlab.freedesktop.org/gstreamer/gstreamer -Dpackage-name="GStreamer $(date)" | tee build.log \
    && ninja \
    && ninja install
    
    # gst-plugins-ugly
WORKDIR /usr/local/src/gstreamer/subprojects/gst-plugins-ugly
RUN mkdir build \
    && cd build \
    && meson --prefix=/usr --buildtype=release -Dpackage-origin=https://gitlab.freedesktop.org/gstreamer/gstreamer -Dpackage-name="GStreamer $(date)" -Dgpl=enabled | tee build.log \
    && ninja \
    && ninja install
    
    # gst-plugins-bad
WORKDIR /usr/local/src/gstreamer/subprojects/gst-plugins-bad
RUN mkdir build \
    && cd build \
    && meson --prefix=/usr --buildtype=release -Dpackage-origin=https://gitlab.freedesktop.org/gstreamer/gstreamer -Dpackage-name="GStreamer $(date)" | tee build.log \
    && ninja \
    && ninja install

    # gst-libav
WORKDIR /usr/local/src/gstreamer/subprojects/gst-libav
RUN mkdir build \
    && cd build \
    && meson --prefix=/usr --buildtype=release -Dpackage-origin=https://gitlab.freedesktop.org/gstreamer/gstreamer -Dpackage-name="GStreamer $(date)" | tee build.log \
    && ninja \
    && ninja install


# RUN apt-get update && apt-get install -y \
#     libgstreamer1.0-dev \
#     libgstreamer-plugins-base1.0-dev \
#     libgstreamer-plugins-bad1.0-dev \
#     gstreamer1.0-plugins-base \
#     gstreamer1.0-plugins-good \
#     gstreamer1.0-plugins-bad \
#     gstreamer1.0-plugins-ugly \
#     gstreamer1.0-libav \
#     gstreamer1.0-doc \
#     gstreamer1.0-tools \
#     gstreamer1.0-x \
#     gstreamer1.0-alsa \
#     gstreamer1.0-gl \
#     gstreamer1.0-gtk3 \
#     gstreamer1.0-qt5 \
#     gstreamer1.0-pulseaudio

# ONLY FOR CHECKING CONTAINER NETWORK
RUN apt-get update && apt-get install -y --no-install-recommends \
    net-tools \
    iputils-ping

WORKDIR /opt/
COPY . /opt/

RUN make

# Experimenting with RTSP
# && ./test-launch "videotestsrc ! x264enc ! rtph264pay name=pay0 pt=96" \
CMD echo "Waiting a few seconds for you to open the browser at localhost:8080" \
    # ONLY FOR CHECKING CONTAINER NETWORK
    # && ifconfig \
    # && ping 192.168.2.183 \
    && sleep 10 \
    && ./webrtc-sendrecv \
    --peer-id=1 \
    --server=ws://signalling:8443 \
    --disable-ssl
